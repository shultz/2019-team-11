import ajax from 'ajax'

export default async function getEcoliData(huc) {
    var url = "https://www.waterqualitydata.us/data/Result/search?"
    var query = "startDateLo=01-01-2017&huc=" + huc + "&mimeType=xml&characteristicName=Escherichia%20coli";
    ajax({
        url: url + query,
        type: "GET",
        dataType: "xml",
        success: function(data) {
	    return data;
        },
        error: function(request, error) {
            return "She get wet";
        }
    });
}

async function getFibiData() {
    
}

async function getEcoliData() {
    
}
