# Kartverket GeoJSON

A set of tools for finding information about Norwegian places using services from [Kartverket](https://kartverket.no/), returned on the GeoJSON format.

Install using npm. Requires Node 8 or higher.

```
npm install kartverket-geojson
```

Import the functions you want

```
const { searchByCoordinates, searchByName } = require('kartverket-geojson')
// or
import { searchByCoordinates, searchByName } from 'kartverket-geojson'
```

## Licensing

This library works by querying three REST services from Kartverket and combining the results into one GeoJSON result. If you are using this library, you need to accept the Kartverket's terms of use for these services.

You can find the terms here: https://kartverket.no/data/Lisens/.

Services used:

- Place names: [Kartverkets åpne API for søk etter stedsnavn](https://ws.geonorge.no/stedsnavn/v1/)
- Altitude: [Åpent API for høyde- og dybdedata fra Kartverket](https://ws.geonorge.no/hoydedata/v1/)
- Counties and municipalities: [Åpent API fra Kartverket for administrative enheter](https://ws.geonorge.no/kommuneinfo/v1/)

## API

### searchByCoordinates

```
(coordinates: { latitude: number, longitude: number }) => Promise<GeoJSON Feature>
```

[Read about the GeoJSON Feature here](https://tools.ietf.org/html/rfc7946#section-3.2)

Call this with a set of coordinates and receive information about that geolocation.
It uses the location closest to the specifed coordinates

#### Parameters

- `coordinates` (`object`): The coordinates object to search for
  - `longitude` (`number`): The longitude
  - `latitude` (`number`): The latitude
- `options` (`object`) [Optional]
  - `epsg` (`string`) [Optional]: The EPSG code for the coordinate system to use. Default is `"4258"`.

#### Example

Example call:

```
searchByCoordinates({ latitude: 60.374357, longitude: 6.1492677 })
```

Example result:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [6.1492677, 60.374357, 18.34]
  },
  "properties": {
    "county": "Vestland",
    "municipality": "Kvam",
    "placeNumber": 1039346,
    "placeName": "Nedre Norheim"
  }
}
```

### searchByName

```
(name: string, options?: { limit?: number }) => Promise<GeoJSON FeatureCollection>
```

[Read about the GeoJSON FeatureCollection here](https://tools.ietf.org/html/rfc7946#section-3.3)

Search for locations with a given name.

#### Parameters

- `name` (`string`): The name of the location you are searching for
- `options` (`object`) [Optional]
  - `limit` (`number`) [Optional]: The maximum number of results to fetch. Default value is 10.
  - `epsg` (`string`) [Optional]: The EPSG code for the coordinate system to use. Default is `"4258"`.

### Example

Example call:

```js
searchByName("Oslo S");
```

Example response:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [10.75226, 59.91067, 2.7]
      },
      "properties": {
        "placeNumber": 369108,
        "nameType": "Stasjon",
        "county": "Oslo",
        "municipality": "Oslo",
        "placeName": "Oslo sentralstasjon"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [10.73353, 59.91187, 4.8]
      },
      "properties": {
        "placeNumber": 509924,
        "nameType": "Fylke",
        "county": "Oslo",
        "municipality": "Oslo",
        "placeName": "Oslo fylke"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [10.74609, 59.91273, 10.5]
      },
      "properties": {
        "placeNumber": 307915,
        "nameType": "By",
        "county": "Oslo",
        "municipality": "Oslo",
        "placeName": "Oslo"
      }
    }
  ]
}
```
