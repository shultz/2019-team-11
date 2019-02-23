import axios from "axios";
import Point from "models/point.js";
import Data from "models/data.js";
import {
    FIBI_URL,
    FIBI_BY_SITE_URL,
    EPA_URL,
    SAMPLE_RESULTS_URL,
    ERROR_SHE_GET_WET
} from "./constants/urls";
// axios.defaults.timeout = 1000000000;

async function getEcoliData(huc) {
    let charName = "Escherichia%20coli";
    let sampleResult = await getSampleResults(huc, charName);
    let dataSamples = getValueDataFromXml(sampleResult.data)

    let locationResult = await getEpaStations(huc, charName);
    let pointSamples = getLocationDataFromXml(locationResult.data)

    for (let key of pointSamples.keys()) {
        let data = dataSamples.get(key);
        if (data !== undefined) {
            pointSamples.get(key).datas.push(data);
        }
    }

    return pointSamples;
}


async function getNitrateData(huc) {
    let charName = "Nitrate";
    let sampleResult = await getSampleResults(huc, charName);
    let dataSamples = getValueDataFromXml(sampleResult.data)
    
    let locationResult = await getEpaStations(huc, charName);
    let pointSamples = getLocationDataFromXml(locationResult.data)

    for (let key of pointSamples.keys()) {
	let data = dataSamples.get(key);
	if (data !== undefined) {
	    pointSamples.get(key).datas.push(data);
	}
    }
    
    return pointSamples;
}

function getValueDataFromXml(xml) {
    let parsedResult = new DOMParser().parseFromString(xml, "text/xml");
    let activities = parsedResult.getElementsByTagName("Activity");
    let samples = new Map();
    for (let activity of activities) {
	let sample = new Data();

        const getTagValue = (qualifiedName) => {
            let tag = activity.getElementsByTagName(qualifiedName)[0];
            return (tag === undefined) ? null :tag.childNodes[0].nodeValue;
        };

        sample.name = getTagValue("CharacteristicName");
	sample.locId = getTagValue("MonitoringLocationIdentifier");
        sample.date = getTagValue("ActivityStartDate");
        sample.value = getTagValue("ResultMeasureValue");
	sample.unit = getTagValue("MeasureUnitCode");

        let existing = samples[sample.locId];
        if (existing == null || (Date.parse(sample.date) > Date.parse(existing.date))) {
            samples.set(sample.locId, sample);
        }
    }

    return samples;
}

async function convertEsriGeometryPolygonToLatLngList() {
    let request = await axios.get('https://watersgeo.epa.gov/arcgis/rest/services/NHDPlus_NP21/WBD_NP21_Simplified/MapServer/find?searchText=070600051004&contains=true&searchFields=&sr=&layers=huc_12&layerDefs=&returnGeometry=true&maxAllowableOffset=&geometryPrecision=&dynamicLayers=&returnZ=false&returnM=false&gdbVersion=&returnUnformattedValues=false&returnFieldName=false&datumTransformations&layerParameterValues&mapRangeValues&layerRangeValues&f=pjson');
    let esriGeometry = request.data;
    let latLngList = [];
    if (esriGeometry != null && esriGeometry.results != null && esriGeometry.results.length > 0
        && esriGeometry.results[0].geometryType != null && esriGeometry.results[0].geometryType === ("esriGeometryPolygon")) {
        esriGeometry.results[0].geometry.rings[0].forEach((lngLat) => {
            latLngList.push({lat: lngLat[1], lng: lngLat[0]});
        });
    }

    var dataCordsQueryParam = '';
    for (var cords of latLngList) {
        dataCordsQueryParam += cords.lng + ',' + cords.lat + ';'
    }
    dataCordsQueryParam = dataCordsQueryParam.substring(0, dataCordsQueryParam.length - 1); // remove final semicolon

    let url = `http://epsg.io/trans?data=${dataCordsQueryParam}&s_srs=3857&t_srs=4326`
    return await axios.get(url);
}

function getLocationDataFromXml(xml) {
    let parsedResult = new DOMParser().parseFromString(xml, "text/xml");
    let locations = parsedResult.getElementsByTagName("MonitoringLocation");
    let samples = new Map();
    for (let location of locations) {
	let sample = new Point()

        const getTagValue = (qualifiedName) => {
            let tag = location.getElementsByTagName(qualifiedName)[0];
            return (tag === undefined) ? null :tag.childNodes[0].nodeValue;
        };

        sample.locId = getTagValue("MonitoringLocationIdentifier");
	sample.name = getTagValue("MonitoringLocationName");
        sample.lat = getTagValue("LatitudeMeasure");
        sample.long = getTagValue("LongitudeMeasure");

        let existing = samples[sample.locId];
        if (existing == null || (Date.parse(sample.date) > Date.parse(existing.date))) {
            samples.set(sample.locId, sample);
        }
    }

    return samples;
}

async function getFibiData(huc) {
    var isHuc12 = huc.length === 12;
    var huc8 = huc.substring(0, 8);
    var url = FIBI_URL;

    return axios
        .get(url + huc8)
        .then(response => {
            return response.data;
        })
        .then(sites => {
            if (isHuc12) {
                var filteredSites = sites.filter(site => site.huc12 === huc);
                return Promise.resolve(filteredSites);
            }
            return Promise.resolve(sites);
        })
        .then(sites => {
            return sites.map(site => site.id);
        })
        .then(siteIds => {
            return Promise.all(siteIds.map(fetchFibiDataBySiteId));
        })
        .then(results => {
            return [].concat.apply([], results);
        })
        .then(results => {
            // sort
            return results.sort((a, b) => {
                return new Date(b.sampleDate) - new Date(a.sampleDate);
            });
        })
        .then(results => {
            // most recent
            return results[0];
        })
        .then(result => {
            return {
                name: result.site.name,
                lat: result.site.LatDD,
                long: result.site.LongDD,
                data: [
                    {
                        name: "FIBI",
                        unit: "rating",
                        value: result.FIBI,
                        type: result.FIBIType,
                        class: result.FIBIClass,
                        date: result.sampleDate
                    }
                ]
            };
        })
        .catch(function(error) {
            // handle error
            console.log(error);
            return ERROR_SHE_GET_WET;
        });
}

async function fetchFibiDataBySiteId(siteId) {
    var url = FIBI_BY_SITE_URL;
    return axios.get(url + siteId).then(response => {
        return response.data;
    });
}

async function getEpaStations(huc, characteristicName) {
    var url = EPA_URL;
    // TODO: externalize startDateLo from query
    var query = `startDateLo=01-01-2017&huc=${huc}&mimeType=xml&characteristicName=${characteristicName}`;
    return axios
        .get(url + query)
        .then(function(response) {
            // handle success
            return response;
        })
        .catch(function(error) {
            // handle error
            return ERROR_SHE_GET_WET;
        });
}

async function getSampleResults(huc, characteristicName) {
    var url = SAMPLE_RESULTS_URL;
    // TODO: externalize startDateLo from query -> subtract 2 months from today
    var query = `
        "startDateLo=01-01-2017&huc=${huc}&mimeType=xml&characteristicName=${characteristicName}`;
    return axios.get(url + query);
}

async function getHuc(lat, long) {}

export default {
    getEcoliData,
    getFibiData,
    getEpaStations,
    getSampleResults,
    getHuc,
    convertEsriGeometryPolygonToLatLngList
};
