const convert = require('xml-js')
const fetch = require('node-fetch')

const ELEVATION_HOST = 'https://wms.geonorge.no/skwms1/wps.elevation2'
const SSR_HOST = 'https://ws.geonorge.no/SKWS3Index/v2/ssr/sok'
const KOMMUNEINFO_HOST = 'https://ws.geonorge.no/kommuneinfo/v1'

async function parseSsrResponse(response) {
    const xml = await response.text()
    const json = JSON.parse(convert.xml2json(xml, {compact: true, spaces: 0}))
    let data = json.sokRes.stedsnavn
    return data.length ? data : [data]
}

async function getAltitude(lat, lon, epsg = '4258') {
    try {
        const res = await fetch(`${ELEVATION_HOST}?request=Execute&service=WPS&version=1.0.0&identifier=elevation&datainputs=lat=${lat};lon=${lon};epsg=${epsg}`)
        const xml = await res.text()
        const json = JSON.parse(convert.xml2json(xml, {compact: true, spaces: 0}))
        const dataArray = json['wps:ExecuteResponse']['wps:ProcessOutputs']['wps:Output'].map(d => {
            return [d['ows:Title']._text, d['wps:Data']['wps:LiteralData']._text]
        });

        const dataObject = dataArray.reduce((obj, [key, value]) => ({
            ...obj,
            [key]: value === 'None' ? undefined : value
        }), {})

        return {
            ...dataObject,
            elevation: !isNaN(dataObject.elevation) ? Number(dataObject.elevation) : undefined
        }
    } catch (error) {
        return {}
    }
}

async function getCountyAndMunicipality(lat, lon, epsg = '4258') {
    try {
        const res = await fetch(`${KOMMUNEINFO_HOST}/punkt?nord=${lat}&ost=${lon}&koordsys=${epsg}`)
        const { fylkesnavn, kommunenavn } = await res.json()
        return {
            county: fylkesnavn,
            municipality: kommunenavn,
        }
    } catch (error) {
        return {}
    }
}

async function searchByCoordinates({ latitude, longitude }, options) {
    const epsg = options && options.epsg
    try {
        const [countyAndMunicipality, elevationInfo] = await Promise.all([
            getCountyAndMunicipality(latitude, longitude, epsg),
            getAltitude(latitude, longitude, epsg),
        ])

        const { placename, elevation, stedsnummer } = elevationInfo

        const coordinates = typeof elevation === 'undefined'
            ? [longitude, latitude ]
            : [longitude, latitude, elevation]

        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates,
            },
            properties: {
                ...countyAndMunicipality,
                placeName: placename,
                placeNumber: stedsnummer
            }
        }
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(error);
        }
        return null
    }
}

async function searchByName(name, options) {
    const limit = options && typeof options.limit === 'number' ? options.limit : undefined
    const epsg = (options && options.epsg) || '4258'
    try {
        const res = await fetch(`${SSR_HOST}?navn=${encodeURIComponent(name)}*&eksakteForst=true&antPerSide=15&epsgKode=${epsg}&side=0`)
        const data = await parseSsrResponse(res)
        const featuresWithoutAltitude = data
        .slice(0, limit)
        .map(place => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [Number(place.aust._text), Number(place.nord._text)],
            },
            properties: {
                placeNumber: place.ssrId._text,
                nameType: place.navnetype._text,
                county: place.fylkesnavn._text,
                municipality: place.kommunenavn._text,
                placeName: place.stedsnavn._text,
            }
        }))

        const features = await Promise.all(featuresWithoutAltitude.map(async feature => {
            const [lon, lat] = feature.geometry.coordinates
            const { elevation } = await getAltitude(lat, lon)

            const coordinates = typeof elevation === 'undefined'
                ? [lon, lat]
                : [lon, lat, elevation]

            return {
                ...feature,
                geometry: {
                    ...feature.geometry,
                    coordinates,
                },
            }
        }))

        return {
            type: "FeatureCollection",
            features
        }
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(error);
        }
        return null
    }
}

exports.searchByCoordinates = searchByCoordinates
exports.searchByName = searchByName
