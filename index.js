const convert = require('xml-js')
const fetch = require('node-fetch')

const ELEVATION_HOST = 'https://wms.geonorge.no/skwms1/wps.elevation2'
const SSR_HOST = 'https://ws.geonorge.no/SKWS3Index/v2/ssr/sok'

function geoDiff(stedsnavn, lat, lon) {
    const { aust, nord } = stedsnavn
    const lat2 = Number(nord._text)
    const lon2 = Number(aust._text)
    return (lat - lat2)**2 + (lon - lon2)**2
}

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

        return dataArray.reduce((obj, [key, value]) => ({
            ...obj,
            [key]: value === 'None' ? undefined : value
        }), {})
    } catch (error) {
        return {}
    }
}

async function getInfo(lat, lon, epsg = '4258') {
    try {
        const res = await fetch(`${SSR_HOST}?nordLL=${lat - 0.01}&nordUR=${lat + 0.01}&ostLL=${lon - 0.01}&ostUR=${lon + 0.01}&eksakteForst=true&antPerSide=15&epsgKode=${epsg}&side=0`)
        const data = await parseSsrResponse(res)
        data.sort((a, b) => geoDiff(a, lat, lon) - geoDiff(b, lat, lon))
        const info = data[0]
        return {
            county: info.fylkesnavn._text,
            municipality: info.kommunenavn._text,
            nameType: info.navnetype._text,
            placeName: info.stedsnavn._text,
        }
    } catch (error) {
        return {
            county: undefined,
            municipality: undefined,
        }
    }
}

async function searchByCoordinates({ latitude, longitude }, options) {
    const epsg = options && options.epsg
    try {
        const [info, elevationInfo] = await Promise.all([
            getInfo(latitude, longitude, epsg),
            getAltitude(latitude, longitude, epsg),
        ])

        const { placename, elevation, stedsnummer } = elevationInfo

        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [longitude, latitude, Number(elevation)],
            },
            properties: {
                ...info,
                placeName2: placename,
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
            const { elevation, placename } = await getAltitude(lat, lon)

            return {
                ...feature,
                geometry: {
                    ...feature.geometry,
                    coordinates: [lon, lat, Number(elevation)],
                },
                properties: {
                    ...feature.properties,
                    placeName2: placename,
                }
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
