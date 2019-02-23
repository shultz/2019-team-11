import axios from "axios";
import { HUC_FROM_ADDRESS_URL, WATERSHED_DATA_URL } from "./constants/urls";

async function getHucFromAddress(address) {
    var url = HUC_FROM_ADDRESS_URL;
    return axios
        .get(url, {
            params: {
                outFields: "Loc_name,City,Place_addr,Region,RegionAbbr,Country",
                outSR: { latestWkid: 3857, wkid: 102100 },
                f: "json",
                SingleLine: address
            }
        })
        .then(response => {
            if (typeof response.data.candidates[0] === "undefined") {
                return Promise.reject("address not found");
            }
            var firstCandidate = response.data.candidates[0];
            return {
                spatialReference: response.data.spatialReference,
                x: firstCandidate.location.x,
                y: firstCandidate.location.y
            };
        })
        .then(location => {
            return getWatershedData(location);
        });
}

async function getWatershedData(location) {
    var url = WATERSHED_DATA_URL;

    return axios
        .get(url, {
            params: {
                f: "json",
                outFields: "HUC12",
                spatialRel: "esriSpatialRelIntersects",
                where: "1=1",
                geometryType: "esriGeometryPoint",
                inSR: "102100",
                outSR: "102100",
                geometry: location
            }
        })
        .then(response => {
            if (typeof response.data.features[0] === "undefined") {
                return Promise.reject("watershed not found");
            }
            return {
                hucId: response.data.features[0].attributes.HUC12,
                lat: location.x,
                lng: location.y
            };
        });
}

export default { getHucFromAddress };
