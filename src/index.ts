import { xml2json } from "xml-js";
import fetch from "node-fetch";
import { Feature, Point, FeatureCollection } from "geojson";

const ELEVATION_HOST = "https://wms.geonorge.no/skwms1/wps.elevation2";
const SSR_HOST = "https://ws.geonorge.no/stedsnavn/v1";
const KOMMUNEINFO_HOST = "https://ws.geonorge.no/kommuneinfo/v1";

interface SsrPlace {
  fylker: Array<{
    fylkesnummer: string;
    fylkesnavn: string;
  }>;
  kommuner: Array<{
    kommunenummer: string;
    kommunenavn: string;
  }>;
  navneobjekttype: string;
  representasjonspunkt: {
    øst: string;
    nord: string;
  };
  stedsnavn: Array<{
    skrivemåte: string;
    skrivemåtestatus: string;
    navnestatus: string;
    språk: string;
    stedsnavnnummer: number;
  }>;
  stedsnummer: string;
}

interface ElevationInfo {
  elevation?: number;
  stedsnummer?: string;
  placename?: string;
}

async function getAltitude(
  lat: number,
  lon: number,
  epsg = "4258"
): Promise<ElevationInfo> {
  try {
    const res = await fetch(
      `${ELEVATION_HOST}?request=Execute&service=WPS&version=1.0.0&identifier=elevation&datainputs=lat=${lat};lon=${lon};epsg=${epsg}`
    );
    const xml = await res.text();
    const json = JSON.parse(xml2json(xml, { compact: true, spaces: 0 }));
    const dataArray: [string, string] = json["wps:ExecuteResponse"][
      "wps:ProcessOutputs"
    ]["wps:Output"].map((d: any) => {
      return [d["ows:Title"]._text, d["wps:Data"]["wps:LiteralData"]._text];
    });

    const dataObject: Record<string, unknown> = dataArray.reduce(
      (obj, [key, value]) => ({
        ...obj,
        [key]: value === "None" ? undefined : value,
      }),
      {}
    );

    return {
      ...dataObject,
      elevation: Number(dataObject.elevation) || undefined,
    };
  } catch (error) {
    return {};
  }
}

interface AreaInfo {
  county: string;
  municipality: string;
}

async function getCountyAndMunicipality(
  lat: number,
  lon: number,
  epsg = "4258"
): Promise<AreaInfo | null> {
  try {
    const res = await fetch(
      `${KOMMUNEINFO_HOST}/punkt?nord=${lat}&ost=${lon}&koordsys=${epsg}`
    );
    const { fylkesnavn, kommunenavn } = await res.json();
    return {
      county: fylkesnavn,
      municipality: kommunenavn,
    };
  } catch (error) {
    return null;
  }
}

interface LatLon {
  latitude: number;
  longitude: number;
}

export type PlaceProps = {
  placeNumber?: string | undefined;
  nameType?: string | undefined;
  county?: string | undefined;
  municipality?: string | undefined;
  placeName?: string | undefined;
};

export type PlaceFeature = Feature<Point, PlaceProps>;
export type PlaceFeatureCollection = FeatureCollection<Point, PlaceProps>;

/**
 * Call this with a set of coordinates and receive information about that geolocation.
 * It uses the location closest to the specified coordinates
 */
export async function searchByCoordinates(
  { latitude, longitude }: LatLon,
  options?: {
    /** The EPSG code for the coordinate system to use. Default is "4258". */
    epsg: string;
  }
): Promise<PlaceFeature | null> {
  const epsg = options && options.epsg;
  try {
    const [countyAndMunicipality, elevationInfo] = await Promise.all([
      getCountyAndMunicipality(latitude, longitude, epsg),
      getAltitude(latitude, longitude, epsg),
    ]);

    const { placename, elevation, stedsnummer } = elevationInfo;

    const coordinates =
      typeof elevation === "undefined"
        ? [longitude, latitude]
        : [longitude, latitude, elevation];

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates,
      },
      properties: {
        ...countyAndMunicipality,
        placeName: placename,
        placeNumber: stedsnummer,
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
    return null;
  }
}

interface Options {
  /** The maximum number of results to fetch. Default value is 10. */
  limit?: number;
  /** The EPSG code for the coordinate system to use. Default is "4258". */
  epsg?: string;
}

function getPreferredName(names: SsrPlace["stedsnavn"]): string {
  if (names.length === 1) {
    return names[0].skrivemåte;
  }

  const isHovednavn = (name: SsrPlace["stedsnavn"][0]) =>
    name.navnestatus === "hovednavn";

  return (
    (
      names.find(
        (name) =>
          isHovednavn(name) &&
          name.skrivemåtestatus === "godkjent og prioritert"
      ) ||
      names.find(
        (name) => isHovednavn(name) && name.skrivemåtestatus === "vedtatt"
      )
    )?.skrivemåte || "Ukjent"
  );
}

/**
 * Search for locations with a given name.
 */
export async function searchByName(
  name: string,
  options?: Options
): Promise<PlaceFeatureCollection> {
  const limit = typeof options?.limit === "number" ? options.limit : 10;
  const epsg = (options && options.epsg) || "4258";
  try {
    const urlParams = new URLSearchParams({
      sok: name,
      fuzzy: "true",
      treffPerSide: "" + limit,
      utkoordsys: epsg,
      side: "1",
      filtrer:
        "navn.representasjonspunkt,navn.stedsnummer,navn.navneobjekttype,navn.fylker,navn.kommuner,navn.stedsnavn",
    });

    const res = await fetch(`${SSR_HOST}/sted?` + urlParams);
    const data = await res.json();

    const featuresWithoutAltitude: PlaceFeature[] = data.navn.map(
      (place: SsrPlace) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            Number(place.representasjonspunkt.øst),
            Number(place.representasjonspunkt.nord),
          ],
        },
        properties: {
          placeNumber: place.stedsnummer,
          nameType: place.navneobjekttype,
          county: place.fylker[0].fylkesnavn,
          municipality: place.kommuner[0].kommunenavn,
          placeName: getPreferredName(place.stedsnavn),
        },
      })
    );

    const features: PlaceFeature[] = await Promise.all(
      featuresWithoutAltitude.map(async (feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        const { elevation } = await getAltitude(lat, lon);

        const coordinates: Point["coordinates"] =
          typeof elevation === "undefined" ? [lon, lat] : [lon, lat, elevation];

        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates,
          },
        };
      })
    );

    return {
      type: "FeatureCollection",
      features,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
    return {
      type: "FeatureCollection",
      features: [],
    };
  }
}
