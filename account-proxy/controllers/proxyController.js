const { extractAttributes, getYoutubeResponseStatus, checkForGcrFlag } = require('../lib/utils');
const { YouTubeCredentials, YouTubeClientParams } = require('../lib/types');
const innertubeApi = require('../lib/innertubeApi');
const stats = require('../lib/stats');

const credentials = new YouTubeCredentials();
const proxy = process.env.PROXY;

async function handleProxyRequest(req, res, endpoint) {
    const tsStart = new Date().getTime();

    try {
        const clientParams = new YouTubeClientParams();
        clientParams.fromRequest(req);
        clientParams.validate();

        stats.countRequest(clientParams.reason, clientParams.clientName, req.headers['cf-ipcountry'], req.headers['origin']);

        // Hotfix for embed player
        if (clientParams.clientName === 'WEB_EMBEDDED_PLAYER') {
            clientParams.clientName = 'WEB';
            clientParams.clientVersion = '2.20220228.01.00';
        }

        const youtubeResponse = await innertubeApi.sendApiRequest(endpoint, clientParams, credentials, proxy);

        if (typeof youtubeResponse.data !== 'object') {
            throw new Error('Invalid YouTube response received');
        }

        const youtubeData = youtubeResponse.data;
        const youtubeStatus = getYoutubeResponseStatus(youtubeResponse);
        const youtubeGcrFlagSet = checkForGcrFlag(youtubeData);
        const relevantData = extractAttributes(youtubeData,
            [
                'playabilityStatus',
                'videoDetails',
                'streamingData',
                'contents',
                'engagementPanels'
            ]
        )

        relevantData.proxy = {
            clientParams,
            youtubeGcrFlagSet,
            youtubeStatus
        }

        res.status(200).send(relevantData);

        stats.countResponse(endpoint, youtubeStatus, youtubeGcrFlagSet);

    } catch (err) {
        console.error(endpoint, err.message);
        res.status(500).send({ errorMessage: err.message });
        stats.countResponse(endpoint, 'EXCEPTION');
        stats.countException(endpoint, err.message);
    } finally {
        let latencyMs = new Date().getTime() - tsStart;
        stats.countLatency(latencyMs);
    }
}

function getPlayer(req, res) {
    handleProxyRequest(req, res, 'player');
}

function getNext(req, res) {
    handleProxyRequest(req, res, 'next');
}

module.exports = {
    getPlayer,
    getNext
}