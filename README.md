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

This library works by querying two XML REST services from Kartverket and combining the results into one GeoJSON result. If you are using this library, you need to accept the Kartverket's terms of use for these services.

You can find the terms here: https://kartverket.no/data/Lisens/.

Services used:
* [Stedsnavn søketjeneste](https://kartkatalog.geonorge.no/metadata/kartverket/stedsnavn-soketjeneste/302b3664-fe67-4e04-a361-ded4f3589331)
* [Kartverkets Elevation WPS](https://kartkatalog.geonorge.no/metadata/kartverket/kartverkets-elevation-wps/92299496-8836-4fc1-b685-6d14bd0eb749)

## API

### searchByCoordinates
```
(coordinates: { latitude: number, longitude: number }) => Promise<GeoJSON Feature>
```

[Read about the GeoJSON Feature here](https://tools.ietf.org/html/rfc7946#section-3.2)

Call this with a set of coordinates and receive information about that geolocation.
It uses the location closest to the specifed coordinates

#### Parameters

* `coordinates` (`object`): The coordinates object to search for
  - `longitude` (`number`): The longitude
  - `latitude` (`number`): The latitude
* `options` (`object`) [Optional]
  - `epsg` (`string`) [Optional]: The EPSG code for the coordinate system to use. Default is `"4258"`.

#### Example
Example call:
```
searchByCoordinates({ latitude: 60.374357, longitude: 6.1492677 })
```

Example result:
```
{
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": [
            6.1492677,
            60.374357,
            17.9
        ]
    },
    "properties": {
        "county": "Hordaland",
        "municipality": "Kvam",
        "nameType": "Adressenavn (veg/gate)",
        "placeName": "Hundsdalen",
        "placeName2": "Nedre Norheim",
        "placeNumber": "1039346"
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

* `name` (`string`): The name of the location you are searching for
* `options` (`object`) [Optional]
  - `limit` (`number`) [Optional]: The maximum number of results to fetch. Default value is nothing, which means it follows the APIs default value.
  - `epsg` (`string`) [Optional]: The EPSG code for the coordinate system to use. Default is `"4258"`.

### Example

Example call:
```js
searchByName('Oslo S')
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
                "coordinates": [
                    10.7522583333333,
                    59.9106666666667
                ]
            },
            "properties": {
                "placeNumber": "73693",
                "nameType": "Stasjon",
                "county": "Oslo",
                "municipality": "Oslo",
                "placeName2": "Oslo sentralstasjon"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    10.7547388888889,
                    59.9128527777778
                ]
            },
            "properties": {
                "placeNumber": "394213",
                "nameType": "Annen kulturdetalj",
                "county": "Oslo",
                "municipality": "Oslo",
                "placeName2": "Oslo Spektrum"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    10.7522583333333,
                    59.9106666666667
                ]
            },
            "properties": {
                "placeNumber": "73693",
                "nameType": "Stasjon",
                "county": "Oslo",
                "municipality": "Oslo",
                "placeName2": "Oslo sentralstasjon"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    10.7462555555556,
                    59.9073805555556
                ]
            },
            "properties": {
                "placeNumber": "394209",
                "nameType": "Annen kulturdetalj",
                "county": "Oslo",
                "municipality": "Oslo",
                "placeName2": "Oslo Havnelager A/S"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    10.7387416666667,
                    59.90845
                ]
            },
            "properties": {
                "placeNumber": "394229",
                "nameType": "Annen kulturdetalj",
                "county": "Oslo",
                "municipality": "Oslo",
                "placeName2": "Oslo Militære Samfund"
            }
        }
    ]
}
```
