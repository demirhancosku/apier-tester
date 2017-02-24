var fs = require('fs');
var request = require('sync-request');
var Promise = require('promise');
var colors = require('colors/safe');


var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var client = request;
var chainedRequests = [];
var scenarioInformations = [];
var requestFiles = [];
var requestInfos = [];
var results = [];
var remember = [];
var scenarioDir = 'scenarios';
var requestDir = 'requests';


var files = fs.readdirSync(scenarioDir);

for (k in files) {

    scenarioInformations[k] = JSON.parse(fs.readFileSync(scenarioDir + '/' + files[k], 'utf8'));
    requestFiles[k] = [];
    requestInfos[k] = [];

    for (si in scenarioInformations[k].order) {

        requestFiles[k][si] = scenarioInformations[k].order[si];
        requestInfos[k][si] = JSON.parse(fs.readFileSync(requestDir + '/' + requestFiles[k][si] + '.json', 'utf8'));

        (function (scenarioInformation, requestInfo) {
            chainedRequests.push(new Promise(function (resolve, reject) {

                if (requestInfo.method === 'get') {
                    var data = requestInfo.send;

                    for (x in remember) {
                        data = Object.assign(data, remember[x]);
                    }
                    var serializedData = requestSerialize(requestInfo.send);

                    var res = client(requestInfo.method, config.base+'/'+requestInfo.endpoint + '/?' + serializedData);
                    var body = JSON.parse(res.body.toString('utf8'));

                    evalRequest(scenarioInformation, requestInfo, body, resolve, reject);

                } else if (requestInfo.method === 'post') {


                    var data = requestInfo.send;

                    for (x in remember) {
                        data = Object.assign(data, remember[x]);
                    }


                    var res = client(requestInfo.method, config.base+'/'+requestInfo.endpoint, {
                        json: data
                    });

                    if (res.statusCode == 500) {
                        console.log(colors.red(requestInfo.name + ' Fatal Error'));
                        console.log("DATA: %j", data);
                        console.log("URL: %j", config.base+'/'+requestInfo.endpoint);

                    }else{
                        var body = JSON.parse(res.body.toString('utf8'));
                    }


                    evalRequest(scenarioInformation, requestInfo, body, resolve, reject);

                }

            }));

        })(scenarioInformations[k], requestInfos[k][si])


    }
}

makeRequests(0, chainedRequests);


function makeRequests(i, chained) {

    if (chained[i] !== undefined) {
        chained[i].then(function (result) {
            if (results[result.case] === undefined) {
                results[result.case] = [];
            }
            results[result.case].push(createResultObject(result.body.status, result));
            makeRequests(++i, chained);

        }).catch(function (result) {
            if (results[result.case] === undefined) {
                results[result.case] = [];
            }

            results[result.case].push(createResultObject(false, result));
            makeRequests(++i, chained);

        });

    } else {

        console.log(colors.bgRed('           CASE RESULTS           '));
        for (j in results) {
            console.log(colors.magenta('CASE NAME') + ': ' + colors.magenta.underline(j));

            for (t in results[j]) {

                if (typeof results[j][t].data !== typeof {}) {
                    results[j][t].data = {'messages': 'api error'};
                } else {
                    if (results[j][t].data.messages === undefined) {
                        results[j][t].data.messages = '';
                    }
                }

                if (results[j][t].result) {
                    console.log(colors.green(results[j][t].name) + ' URL: ' + results[j][t].url + '  Message: ' + colors.green(results[j][t].flag));
                }
                else {
                    console.log(colors.red(results[j][t].name) + ' URL:' + results[j][t].url + '  Message: ' + colors.blue(results[j][t].data.messages));
                }
            }
        }

    }
}


function createResultObject(status, result) {

    var flag = "failed";
    if (status) {
        flag = "passed";
    }
    return {
        "name": result.requestInfo.name,
        "url": config.base +'/'+ result.requestInfo.endpoint,
        "result": status,
        "flag": flag,
        "data": result.body
    }
}

function evalRequest(scenarioInformation, requestInfo, body, resolve, reject) {
    var flag = true;

    for (remem in requestInfo.remember) {
        if (body.data[requestInfo.remember[remem]] == undefined) {
            flag = false;
        } else {
            var obj = {};
            obj[requestInfo.remember[remem]] = body.data[requestInfo.remember[remem]];

            var exist = false;
            for(look in remember){
                if(remember[look] === obj){
                    exist = true
                }
            }

            if(!exist)
            remember.push(obj);
        }
    }

    for (expect in requestInfo.expected) {
        if (body[requestInfo.expected[expect].data] == undefined || body[requestInfo.expected[expect].data] != requestInfo.expected[expect].value) {
            flag = false;
        }
    }

    if (flag) {
        resolve({'case': scenarioInformation.name, 'requestInfo': requestInfo, 'body': body});
    } else {
        resolve({'case': scenarioInformation.name, 'requestInfo': requestInfo, 'body': body});
    }
}

function requestSerialize(obj) {
    var str = [];
    for (var p in obj)
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
    return str.join("&");
}

