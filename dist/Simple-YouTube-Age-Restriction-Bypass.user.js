
// ==UserScript==
// @name            Simple YouTube Age Restriction Bypass
// @description     Watch age restricted videos on YouTube without login and without age verification :)
// @description:de  Schaue YouTube Videos mit Altersbeschränkungen ohne Anmeldung und ohne dein Alter zu bestätigen :)
// @description:fr  Regardez des vidéos YouTube avec des restrictions d'âge sans vous inscrire et sans confirmer votre âge :)
// @description:it  Guarda i video con restrizioni di età su YouTube senza login e senza verifica dell'età :)
// @version         2.4.7
// @updateURL       https://github.com/NiborH68/Simple-YouTube-Age-and-Workspace-Restriction-Bypass/raw/main/dist/Simple-YouTube-Age-Restriction-Bypass.user.js
// @downloadURL     https://github.com/NiborH68/Simple-YouTube-Age-and-Workspace-Restriction-Bypass/raw/main/dist/Simple-YouTube-Age-Restriction-Bypass.user.js
// @author          Zerody (https://github.com/zerodytrash)
// @namespace       https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/
// @supportURL      https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/issues
// @license         MIT
// @match           https://www.youtube.com/*
// @match           https://www.youtube-nocookie.com/*
// @match           https://m.youtube.com/*
// @match           https://music.youtube.com/*
// @grant           none
// @run-at          document-start
// @compatible      chrome Chrome + Tampermonkey or Violentmonkey
// @compatible      firefox Firefox + Greasemonkey or Tampermonkey or Violentmonkey
// @compatible      opera Opera + Tampermonkey or Violentmonkey
// @compatible      edge Edge + Tampermonkey or Violentmonkey
// @compatible      safari Safari + Tampermonkey or Violentmonkey
// ==/UserScript==

/*
    This is a transpiled version to achieve a clean code base and better browser compatibility.
    You can find the nicely readable source code at https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass
*/

(function iife(inject) {
  // Trick to get around the sandbox restrictions in Greasemonkey (Firefox)
  // Inject code into the main window if criteria match
  if (this !== window && inject) {
    window.eval("(" + iife.toString() + ")();");
    return;
  }


  // Script configuration variables
  const UNLOCKABLE_PLAYABILITY_STATUSES = ['AGE_VERIFICATION_REQUIRED', 'AGE_CHECK_REQUIRED', 'LOGIN_REQUIRED'];
  const VALID_PLAYABILITY_STATUSES = ['OK', 'LIVE_STREAM_OFFLINE'];

  // User needs to confirm the unlock process on embedded player?
  const ENABLE_UNLOCK_CONFIRMATION_EMBED = false;

  // These are the proxy servers that are sometimes required to unlock videos with age restrictions.
  // You can host your own account proxy instance. See https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/tree/main/account-proxy
  // To learn what information is transferred, please read: https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass#privacy
  const ACCOUNT_PROXY_SERVER_HOST = 'https://youtube-proxy.zerody.one';
  const VIDEO_PROXY_SERVER_HOST = 'https://phx.4everproxy.com';

  // Whether a thumbnail is blurred can be detected by the following "sqp" parameter values in the thumbnail URL.
  // Seems to be base64 encoded protobuf objects, see https://stackoverflow.com/a/51203860
  const THUMBNAIL_BLURRED_SQPS = [
  '-oaymwEpCOADEI4CSFryq4qpAxsIARUAAAAAGAElAADIQj0AgKJDeAHtAZmZGUI=', // Desktop 480x270
  '-oaymwEiCOADEI4CSFXyq4qpAxQIARUAAIhCGAFwAcABBu0BmZkZQg==', // Desktop 480x270
  '-oaymwEiCOgCEMoBSFXyq4qpAxQIARUAAIhCGAFwAcABBu0BZmbmQQ==', // Desktop 360x202
  '-oaymwEiCNAFEJQDSFXyq4qpAxQIARUAAIhCGAFwAcABBu0BZmZmQg==', // Desktop 720x404
  '-oaymwEdCNAFEJQDSFryq4qpAw8IARUAAIhCGAHtAWZmZkI=', // Desktop 720x404
  '-oaymwEdCNACELwBSFryq4qpAw8IARUAAIhCGAHtAT0K10E=', // Desktop 336x188
  '-oaymwESCMACELQB8quKqQMG7QHMzMxB', // Mobile 320x180
  '-oaymwESCOADEOgC8quKqQMG7QGZmRlC' // Mobile 480x360
  ];

  const nativeJSONParse = window.JSON.parse;

  const nativeXMLHttpRequestOpen = XMLHttpRequest.prototype.open;

  const isDesktop = window.location.host !== 'm.youtube.com';
  const isMusic = window.location.host === 'music.youtube.com';
  const isEmbed = window.location.pathname.indexOf('/embed/') === 0;
  const isConfirmed = window.location.search.includes('unlock_confirmed');

  class Deferred {
    constructor() {
      return Object.assign(
      new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      }),
      this);

    }}


  function createElement(tagName, options) {
    const node = document.createElement(tagName);
    options && Object.assign(node, options);
    return node;
  }

  function isObject(obj) {
    return obj !== null && typeof obj === 'object';
  }

  function findNestedObjectsByAttributeNames(object, attributeNames) {
    var results = [];

    // Does the current object match the attribute conditions?
    if (attributeNames.every((key) => typeof object[key] !== 'undefined')) {
      results.push(object);
    }

    // Diggin' deeper for each nested object (recursive)
    Object.keys(object).forEach((key) => {
      if (object[key] && typeof object[key] === 'object') {
        results.push(...findNestedObjectsByAttributeNames(object[key], attributeNames));
      }
    });

    return results;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  function createDeepCopy(obj) {
    return nativeJSONParse(JSON.stringify(obj));
  }

  function getCurrentVideoStartTime(currentVideoId) {
    // Check if the URL corresponds to the requested video
    // This is not the case when the player gets preloaded for the next video in a playlist.
    if (window.location.href.includes(currentVideoId)) {var _ref;
      // "t"-param on youtu.be urls
      // "start"-param on embed player
      // "time_continue" when clicking "watch on youtube" on embedded player
      const urlParams = new URLSearchParams(window.location.search);
      const startTimeString = (_ref = urlParams.get('t') || urlParams.get('start') || urlParams.get('time_continue')) === null || _ref === void 0 ? void 0 : _ref.replace('s', '');

      if (startTimeString && !isNaN(startTimeString)) {
        return parseInt(startTimeString);
      }
    }

    return 0;
  }

  function setUrlParams(params) {
    const urlParams = new URLSearchParams(window.location.search);
    for (const paramName in params) {
      urlParams.set(paramName, params[paramName]);
    }
    window.location.search = urlParams;
  }

  function waitForElement(elementSelector, timeout) {
    const deferred = new Deferred();

    const checkDomInterval = setInterval(() => {
      const elem = document.querySelector(elementSelector);
      if (elem) {
        clearInterval(checkDomInterval);
        deferred.resolve(elem);
      }
    }, 100);

    if (timeout) {
      setTimeout(() => {
        clearInterval(checkDomInterval);
        deferred.reject();
      }, timeout);
    }

    return deferred;
  }

  // Source: https://coursesweb.net/javascript/sha1-encrypt-data_cs
  function generateSha1Hash(msg) {
    function rotate_left(n, s) {
      var t4 = n << s | n >>> 32 - s;
      return t4;
    }
    function cvt_hex(val) {
      var str = '';
      var i;
      var v;
      for (var i = 7; i >= 0; i--) {
        v = val >>> i * 4 & 0x0f;
        str += v.toString(16);
      }
      return str;
    }
    function Utf8Encode(string) {
      string = string.replace(/\r\n/g, '\n');
      var utftext = '';
      for (var n = 0; n < string.length; n++) {
        var c = string.charCodeAt(n);
        if (c < 128) {
          utftext += String.fromCharCode(c);
        } else if (c > 127 && c < 2048) {
          utftext += String.fromCharCode(c >> 6 | 192);
          utftext += String.fromCharCode(c & 63 | 128);
        } else {
          utftext += String.fromCharCode(c >> 12 | 224);
          utftext += String.fromCharCode(c >> 6 & 63 | 128);
          utftext += String.fromCharCode(c & 63 | 128);
        }
      }
      return utftext;
    }
    var blockstart;
    var i, j;
    var W = new Array(80);
    var H0 = 0x67452301;
    var H1 = 0xefcdab89;
    var H2 = 0x98badcfe;
    var H3 = 0x10325476;
    var H4 = 0xc3d2e1f0;
    var A, B, C, D, E;
    var temp;
    msg = Utf8Encode(msg);
    var msg_len = msg.length;
    var word_array = new Array();
    for (var i = 0; i < msg_len - 3; i += 4) {
      j = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 | msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3);
      word_array.push(j);
    }
    switch (msg_len % 4) {
      case 0:
        i = 0x080000000;
        break;
      case 1:
        i = msg.charCodeAt(msg_len - 1) << 24 | 0x0800000;
        break;
      case 2:
        i = msg.charCodeAt(msg_len - 2) << 24 | msg.charCodeAt(msg_len - 1) << 16 | 0x08000;
        break;
      case 3:
        i = msg.charCodeAt(msg_len - 3) << 24 | msg.charCodeAt(msg_len - 2) << 16 | msg.charCodeAt(msg_len - 1) << 8 | 0x80;
        break;}

    word_array.push(i);
    while (word_array.length % 16 != 14) word_array.push(0);
    word_array.push(msg_len >>> 29);
    word_array.push(msg_len << 3 & 0x0ffffffff);
    for (var blockstart = 0; blockstart < word_array.length; blockstart += 16) {
      for (var i = 0; i < 16; i++) W[i] = word_array[blockstart + i];
      for (var i = 16; i <= 79; i++) W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
      A = H0;
      B = H1;
      C = H2;
      D = H3;
      E = H4;
      for (var i = 0; i <= 19; i++) {
        temp = rotate_left(A, 5) + (B & C | ~B & D) + E + W[i] + 0x5a827999 & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
      for (var i = 20; i <= 39; i++) {
        temp = rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ed9eba1 & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
      for (var i = 40; i <= 59; i++) {
        temp = rotate_left(A, 5) + (B & C | B & D | C & D) + E + W[i] + 0x8f1bbcdc & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
      for (var i = 60; i <= 79; i++) {
        temp = rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xca62c1d6 & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
      H0 = H0 + A & 0x0ffffffff;
      H1 = H1 + B & 0x0ffffffff;
      H2 = H2 + C & 0x0ffffffff;
      H3 = H3 + D & 0x0ffffffff;
      H4 = H4 + E & 0x0ffffffff;
    }

    return (cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4)).toLowerCase();
  }

  function getYtcfgValue(name) {var _window$ytcfg;
    return (_window$ytcfg = window.ytcfg) === null || _window$ytcfg === void 0 ? void 0 : _window$ytcfg.get(name);
  }

  function isUserLoggedIn() {
    // Session Cookie exists?
    if (!getSidCookie()) return false;

    // LOGGED_IN doesn't exist on embedded page, use DELEGATED_SESSION_ID as fallback
    if (typeof getYtcfgValue('LOGGED_IN') === 'boolean') return getYtcfgValue('LOGGED_IN');
    if (typeof getYtcfgValue('DELEGATED_SESSION_ID') === 'string') return true;

    return false;
  }

  function getPlayer$1(payload, requiresAuth) {
    return sendInnertubeRequest('v1/player', payload, requiresAuth);
  }

  function getSignatureTimestamp() {
    return (
      getYtcfgValue('STS') ||
      (() => {var _document$querySelect;
        // STS is missing on embedded player. Retrieve from player base script as fallback...
        const playerBaseJsPath = (_document$querySelect = document.querySelector('script[src*="/base.js"]')) === null || _document$querySelect === void 0 ? void 0 : _document$querySelect.src;

        if (!playerBaseJsPath) return;

        const xmlhttp = new XMLHttpRequest();
        xmlhttp.open('GET', playerBaseJsPath, false);
        xmlhttp.send(null);

        return parseInt(xmlhttp.responseText.match(/signatureTimestamp:([0-9]*)/)[1]);
      })());

  }

  function sendInnertubeRequest(endpoint, payload, useAuth) {
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.open('POST', `/youtubei/${endpoint}?key=${getYtcfgValue('INNERTUBE_API_KEY')}`, false);
    if (useAuth && isUserLoggedIn()) {
      xmlhttp.withCredentials = true;
      xmlhttp.setRequestHeader('Authorization', generateSidBasedAuth());
    }
    xmlhttp.send(JSON.stringify(payload));
    return nativeJSONParse(xmlhttp.responseText);
  }

  function getSidCookie() {
    return getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
  }

  function generateSidBasedAuth() {
    const sid = getSidCookie();
    const timestamp = Math.floor(new Date().getTime() / 1000);
    const input = timestamp + ' ' + sid + ' ' + location.origin;
    const hash = generateSha1Hash(input);
    return `SAPISIDHASH ${timestamp}_${hash}`;
  }

  const logPrefix = '%cSimple-YouTube-Age-Restriction-Bypass:';
  const logPrefixStyle = 'background-color: #1e5c85; color: #fff; font-size: 1.2em;';
  const logSuffix = '\uD83D\uDC1E You can report bugs at: https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/issues';

  function error(err, msg) {
    console.error(logPrefix, logPrefixStyle, msg, err, getYtcfgDebugString(), '\n\n', logSuffix);
  }

  function info(msg) {
    console.info(logPrefix, logPrefixStyle, msg);
  }

  function getYtcfgDebugString() {
    try {
      return (
        `InnertubeConfig: ` +
        `innertubeApiKey: ${getYtcfgValue('INNERTUBE_API_KEY')} ` +
        `innertubeClientName: ${getYtcfgValue('INNERTUBE_CLIENT_NAME')} ` +
        `innertubeClientVersion: ${getYtcfgValue('INNERTUBE_CLIENT_VERSION')} ` +
        `loggedIn: ${getYtcfgValue('LOGGED_IN')} `);

    } catch (err) {
      return `Failed to access config: ${err}`;
    }
  }

  function interceptObjectProperty(prop, onSet) {var _Object$getOwnPropert;
    // Allow other userscripts to decorate this descriptor, if they do something similar
    const dataKey = '__SYARB_' + prop;
    const { get: getter, set: setter } = (_Object$getOwnPropert = Object.getOwnPropertyDescriptor(Object.prototype, prop)) !== null && _Object$getOwnPropert !== void 0 ? _Object$getOwnPropert : {
      set(value) {
        this[dataKey] = value;
      },
      get() {
        return this[dataKey];
      } };


    // Intercept the given property on any object
    // The assigned attribute value and the context (enclosing object) are passed to the onSet function.
    Object.defineProperty(Object.prototype, prop, {
      set(value) {
        setter.call(this, isObject(value) ? onSet(this, value) : value);
      },
      get() {
        return getter.call(this);
      },
      configurable: true });

  }

  function attachInitialDataInterceptor(onInitialData) {
    // And here we deal with YouTube's crappy initial data (present in page source) and the problems that occur when intercepting that data.
    // YouTube has some protections in place that make it difficult to intercept and modify the global ytInitialPlayerResponse variable.
    // The easiest way would be to set a descriptor on that variable to change the value directly on declaration.
    // But some adblockers define their own descriptors on the ytInitialPlayerResponse variable, which makes it hard to register another descriptor on it.
    // As a workaround only the relevant playerResponse property of the ytInitialPlayerResponse variable will be intercepted.
    // This is achieved by defining a descriptor on the object prototype for that property, which affects any object with a `playerResponse` property.
    interceptObjectProperty('playerResponse', (obj, playerResponse) => {
      info(`playerResponse property set, contains sidebar: ${!!obj.response}`);

      // The same object also contains the sidebar data and video description
      if (isObject(obj.response)) onInitialData(obj.response);

      // If the script is executed too late and the bootstrap data has already been processed,
      // a reload of the player can be forced by creating a deep copy of the object.
      // This is especially relevant if the userscript manager does not handle the `@run-at document-start` correctly.
      playerResponse.unlocked = false;
      onInitialData(playerResponse);
      return playerResponse.unlocked ? createDeepCopy(playerResponse) : playerResponse;
    });

    // The global `ytInitialData` variable can be modified on the fly.
    // It contains search results, sidebar data and meta information
    // Not really important but fixes https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/issues/127
    window.addEventListener('DOMContentLoaded', () => {
      if (isObject(window.ytInitialData)) {
        onInitialData(window.ytInitialData);
      }
    });
  }

  // Intercept, inspect and modify JSON-based communication to unlock player responses by hijacking the JSON.parse function
  function attachJsonInterceptor(onJsonDataReceived) {
    window.JSON.parse = function () {
      const data = nativeJSONParse.apply(this, arguments);
      return isObject(data) ? onJsonDataReceived(data) : data;
    };
  }

  function attachXhrOpenInterceptor(onXhrOpenCalled) {
    XMLHttpRequest.prototype.open = function (method, url) {
      if (typeof url === 'string' && url.indexOf('https://') === 0) {
        const modifiedUrl = onXhrOpenCalled(this, method, new URL(url));

        if (typeof modifiedUrl === 'string') {
          arguments[1] = modifiedUrl;
        }
      }

      nativeXMLHttpRequestOpen.apply(this, arguments);
    };
  }

  function isPlayerObject(parsedData) {
    return (parsedData === null || parsedData === void 0 ? void 0 : parsedData.videoDetails) && (parsedData === null || parsedData === void 0 ? void 0 : parsedData.playabilityStatus);
  }

  function isEmbeddedPlayerObject(parsedData) {
    return typeof (parsedData === null || parsedData === void 0 ? void 0 : parsedData.previewPlayabilityStatus) === 'object';
  }

  function isAgeRestricted(playabilityStatus) {var _playabilityStatus$er, _playabilityStatus$er2, _playabilityStatus$er3, _playabilityStatus$er4, _playabilityStatus$er5, _playabilityStatus$er6, _playabilityStatus$er7, _playabilityStatus$er8;
    if (!(playabilityStatus !== null && playabilityStatus !== void 0 && playabilityStatus.status)) return false;
    if (playabilityStatus.desktopLegacyAgeGateReason) return true;
    if (UNLOCKABLE_PLAYABILITY_STATUSES.includes(playabilityStatus.status)) return true;

    // Fix to detect age restrictions on embed player
    // see https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/issues/85#issuecomment-946853553
    return (
      isEmbed && ((_playabilityStatus$er =
      playabilityStatus.errorScreen) === null || _playabilityStatus$er === void 0 ? void 0 : (_playabilityStatus$er2 = _playabilityStatus$er.playerErrorMessageRenderer) === null || _playabilityStatus$er2 === void 0 ? void 0 : (_playabilityStatus$er3 = _playabilityStatus$er2.reason) === null || _playabilityStatus$er3 === void 0 ? void 0 : (_playabilityStatus$er4 = _playabilityStatus$er3.runs) === null || _playabilityStatus$er4 === void 0 ? void 0 : (_playabilityStatus$er5 = _playabilityStatus$er4.find((x) => x.navigationEndpoint)) === null || _playabilityStatus$er5 === void 0 ? void 0 : (_playabilityStatus$er6 = _playabilityStatus$er5.navigationEndpoint) === null || _playabilityStatus$er6 === void 0 ? void 0 : (_playabilityStatus$er7 = _playabilityStatus$er6.urlEndpoint) === null || _playabilityStatus$er7 === void 0 ? void 0 : (_playabilityStatus$er8 = _playabilityStatus$er7.url) === null || _playabilityStatus$er8 === void 0 ? void 0 : _playabilityStatus$er8.includes('/2802167')));

  }

  function isWatchNextObject(parsedData) {var _parsedData$currentVi, _parsedData$currentVi2;
    if (!(parsedData !== null && parsedData !== void 0 && parsedData.contents) || !(parsedData !== null && parsedData !== void 0 && (_parsedData$currentVi = parsedData.currentVideoEndpoint) !== null && _parsedData$currentVi !== void 0 && (_parsedData$currentVi2 = _parsedData$currentVi.watchEndpoint) !== null && _parsedData$currentVi2 !== void 0 && _parsedData$currentVi2.videoId)) return false;
    return !!parsedData.contents.twoColumnWatchNextResults || !!parsedData.contents.singleColumnWatchNextResults;
  }

  function isWatchNextSidebarEmpty(parsedData) {var _parsedData$contents2, _parsedData$contents3, _parsedData$contents4, _parsedData$contents5, _content$find;
    if (isDesktop) {var _parsedData$contents, _parsedData$contents$, _parsedData$contents$2, _parsedData$contents$3;
      // WEB response layout
      const result = (_parsedData$contents = parsedData.contents) === null || _parsedData$contents === void 0 ? void 0 : (_parsedData$contents$ = _parsedData$contents.twoColumnWatchNextResults) === null || _parsedData$contents$ === void 0 ? void 0 : (_parsedData$contents$2 = _parsedData$contents$.secondaryResults) === null || _parsedData$contents$2 === void 0 ? void 0 : (_parsedData$contents$3 = _parsedData$contents$2.secondaryResults) === null || _parsedData$contents$3 === void 0 ? void 0 : _parsedData$contents$3.results;
      return !result;
    }

    // MWEB response layout
    const content = (_parsedData$contents2 = parsedData.contents) === null || _parsedData$contents2 === void 0 ? void 0 : (_parsedData$contents3 = _parsedData$contents2.singleColumnWatchNextResults) === null || _parsedData$contents3 === void 0 ? void 0 : (_parsedData$contents4 = _parsedData$contents3.results) === null || _parsedData$contents4 === void 0 ? void 0 : (_parsedData$contents5 = _parsedData$contents4.results) === null || _parsedData$contents5 === void 0 ? void 0 : _parsedData$contents5.contents;
    const result = content === null || content === void 0 ? void 0 : (_content$find = content.find((e) => {var _e$itemSectionRendere;return ((_e$itemSectionRendere = e.itemSectionRenderer) === null || _e$itemSectionRendere === void 0 ? void 0 : _e$itemSectionRendere.targetId) === 'watch-next-feed';})) === null || _content$find === void 0 ? void 0 : _content$find.itemSectionRenderer;
    return typeof result !== 'object';
  }

  function isGoogleVideo(method, url) {
    return method === 'GET' && url.host.includes('.googlevideo.com');
  }

  function isGoogleVideoUnlockRequired(googleVideoUrl, lastProxiedGoogleVideoId) {
    const urlParams = new URLSearchParams(googleVideoUrl.search);
    const hasGcrFlag = urlParams.get('gcr');
    const wasUnlockedByAccountProxy = urlParams.get('id') === lastProxiedGoogleVideoId;

    return hasGcrFlag && wasUnlockedByAccountProxy;
  }

  function isSearchResult(parsedData) {var _parsedData$contents6, _parsedData$contents7, _parsedData$contents8, _parsedData$onRespons, _parsedData$onRespons2, _parsedData$onRespons3;
    return (
      typeof (parsedData === null || parsedData === void 0 ? void 0 : (_parsedData$contents6 = parsedData.contents) === null || _parsedData$contents6 === void 0 ? void 0 : _parsedData$contents6.twoColumnSearchResultsRenderer) === 'object' || // Desktop initial results
      (parsedData === null || parsedData === void 0 ? void 0 : (_parsedData$contents7 = parsedData.contents) === null || _parsedData$contents7 === void 0 ? void 0 : (_parsedData$contents8 = _parsedData$contents7.sectionListRenderer) === null || _parsedData$contents8 === void 0 ? void 0 : _parsedData$contents8.targetId) === 'search-feed' || // Mobile initial results
      (parsedData === null || parsedData === void 0 ? void 0 : (_parsedData$onRespons = parsedData.onResponseReceivedCommands) === null || _parsedData$onRespons === void 0 ? void 0 : (_parsedData$onRespons2 = _parsedData$onRespons.find((x) => x.appendContinuationItemsAction)) === null || _parsedData$onRespons2 === void 0 ? void 0 : (_parsedData$onRespons3 = _parsedData$onRespons2.appendContinuationItemsAction) === null || _parsedData$onRespons3 === void 0 ? void 0 : _parsedData$onRespons3.targetId) === 'search-feed' // Desktop & Mobile scroll continuation
    );
  }

  function getGoogleVideoUrl(originalUrl) {
    return VIDEO_PROXY_SERVER_HOST + '/direct/' + btoa(originalUrl);
  }

  function sendRequest(endpoint, payload) {
    const queryParams = new URLSearchParams(payload);
    const proxyUrl = `${ACCOUNT_PROXY_SERVER_HOST}/${endpoint}?${queryParams}&client=js`;

    try {
      const xmlhttp = new XMLHttpRequest();
      xmlhttp.open('GET', proxyUrl, false);
      xmlhttp.send(null);

      const proxyResponse = nativeJSONParse(xmlhttp.responseText);

      // mark request as 'proxied'
      proxyResponse.proxied = true;

      return proxyResponse;
    } catch (err) {
      error(err, 'Proxy API Error');
      return { errorMessage: 'Proxy Connection failed' };
    }
  }

  function getPlayer(payload) {
    return sendRequest('getPlayer', payload);
  }

  function getNext(payload) {
    return sendRequest('getNext', payload);
  }

  var tDesktop = "<tp-yt-paper-toast></tp-yt-paper-toast>\n";

  var tMobile = "<c3-toast>\n    <ytm-notification-action-renderer>\n        <div class=\"notification-action-response-text\"></div>\n    </ytm-notification-action-renderer>\n</c3-toast>\n";

  const template = isDesktop ? tDesktop : tMobile;

  const nToastContainer = createElement('div', { id: 'toast-container', innerHTML: template });
  const nToast = nToastContainer.querySelector(':scope > *');

  // On YT Music show the toast above the player controls
  if (isMusic) {
    nToast.style['margin-bottom'] = '85px';
  }

  if (!isDesktop) {
    nToast.nMessage = nToast.querySelector('.notification-action-response-text');
    nToast.show = (message) => {
      nToast.nMessage.innerText = message;
      nToast.setAttribute('dir', 'in');
      setTimeout(() => {
        nToast.setAttribute('dir', 'out');
      }, nToast.duration + 225);
    };
  }

  async function show(message) {let duration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 5;
    return;
  }

  var Toast = { show };

  var buttonTemplate = "<div style=\"margin-top: 15px !important; padding: 3px 10px 3px 10px; margin: 0px auto; background-color: #4d4d4d; width: fit-content; font-size: 1.2em; text-transform: uppercase; border-radius: 3px; cursor: pointer;\">\n    <div class=\"button-text\"></div>\n</div>";

  let buttons = {};

  async function addButton(id, text, backgroundColor, onClick) {
    const errorScreenElement = await waitForElement('.ytp-error', 2000);
    const buttonElement = createElement('div', { class: 'button-container', innerHTML: buttonTemplate });
    buttonElement.getElementsByClassName('button-text')[0].innerText = text;

    if (backgroundColor) {
      buttonElement.querySelector(':scope > div').style['background-color'] = backgroundColor;
    }

    if (typeof onClick === 'function') {
      buttonElement.addEventListener('click', onClick);
    }

    // Button already attached?
    if (buttons[id] && buttons[id].isConnected) {
      return;
    }

    buttons[id] = buttonElement;
    errorScreenElement.append(buttonElement);
  }

  function removeButton(id) {
    if (buttons[id] && buttons[id].isConnected) {
      buttons[id].remove();
    }
  }

  const confirmationButtonId = 'confirmButton';
  const confirmationButtonText = 'Click to unlock';

  function isConfirmationRequired() {
    return !isConfirmed && isEmbed && ENABLE_UNLOCK_CONFIRMATION_EMBED;
  }

  function requestConfirmation() {
    addButton(confirmationButtonId, confirmationButtonText, null, () => {
      removeButton(confirmationButtonId);
      confirm();
    });
  }

  function confirm() {
    setUrlParams({
      unlock_confirmed: 1,
      autoplay: 1 });

  }

  const messagesMap = {
    success: 'Age-restricted video successfully unlocked!',
    fail: 'Unable to unlock this video 🙁 - More information in the developer console' };


  let lastProxiedGoogleVideoUrlParams;
  let cachedPlayerResponse = {};

  function getPlayerUnlockStrategies(playerResponse) {var _playerResponse$video, _playerResponse$playa, _playerResponse$previ;
    const videoId = ((_playerResponse$video = playerResponse.videoDetails) === null || _playerResponse$video === void 0 ? void 0 : _playerResponse$video.videoId) || getYtcfgValue('PLAYER_VARS').video_id;
    const reason = ((_playerResponse$playa = playerResponse.playabilityStatus) === null || _playerResponse$playa === void 0 ? void 0 : _playerResponse$playa.status) || ((_playerResponse$previ = playerResponse.previewPlayabilityStatus) === null || _playerResponse$previ === void 0 ? void 0 : _playerResponse$previ.status);
    const clientName = getYtcfgValue('INNERTUBE_CLIENT_NAME') || 'WEB';
    const clientVersion = getYtcfgValue('INNERTUBE_CLIENT_VERSION') || '2.20220203.04.00';
    const signatureTimestamp = getSignatureTimestamp();
    const startTimeSecs = getCurrentVideoStartTime(videoId);
    const hl = getYtcfgValue('HL');

    return [
    // Strategy 1: Retrieve the video info by using the TVHTML5 Embedded client
    // This client has no age restrictions in place (2022-03-28)
    // See https://github.com/zerodytrash/YouTube-Internal-Clients
    {
      name: 'TV Embedded Player',
      requiresAuth: false,
      payload: {
        context: {
          client: {
            clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
            clientVersion: '2.0',
            clientScreen: 'WATCH',
            hl },

          thirdParty: {
            embedUrl: 'https://www.youtube.com/' } },


        playbackContext: {
          contentPlaybackContext: {
            signatureTimestamp } },


        videoId,
        startTimeSecs,
        racyCheckOk: true,
        contentCheckOk: true },

      getPlayer: getPlayer$1 },

    // Strategy 2: Retrieve the video info by using the WEB_CREATOR client in combination with user authentication
    // Requires that the user is logged in. Can bypass the tightened age verification in the EU.
    // See https://github.com/yt-dlp/yt-dlp/pull/600
    {
      name: 'Creator + Auth',
      requiresAuth: true,
      payload: {
        context: {
          client: {
            clientName: 'WEB_CREATOR',
            clientVersion: '1.20210909.07.00',
            hl } },


        playbackContext: {
          contentPlaybackContext: {
            signatureTimestamp } },


        videoId,
        startTimeSecs,
        racyCheckOk: true,
        contentCheckOk: true },

      getPlayer: getPlayer$1 },

    // Strategy 3: Retrieve the video info from an account proxy server.
    // Session cookies of an age-verified Google account are stored on server side.
    // See https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/tree/main/account-proxy
    {
      name: 'Account Proxy',
      requiresAuth: false,
      payload: {
        videoId,
        reason,
        clientName,
        clientVersion,
        signatureTimestamp,
        startTimeSecs,
        hl,
        isEmbed: +isEmbed,
        isConfirmed: +isConfirmed },

      getPlayer: getPlayer }];


  }

  function getLastProxiedGoogleVideoId() {var _lastProxiedGoogleVid;
    return (_lastProxiedGoogleVid = lastProxiedGoogleVideoUrlParams) === null || _lastProxiedGoogleVid === void 0 ? void 0 : _lastProxiedGoogleVid.get('id');
  }

  function unlockPlayerResponse(playerResponse) {var _unlockedPlayerRespon, _unlockedPlayerRespon3;
    // Check if the user has to confirm the unlock first
    if (isConfirmationRequired()) {
      info('Unlock confirmation required.');
      requestConfirmation();
      return playerResponse;
    }

    const unlockedPlayerResponse = getUnlockedPlayerResponse(playerResponse);

    // account proxy error?
    if (unlockedPlayerResponse.errorMessage) {
      Toast.show(`${messagesMap.fail} (ProxyError)`, 10);
      throw new Error(`Player Unlock Failed, Proxy Error Message: ${unlockedPlayerResponse.errorMessage}`);
    }

    // check if the unlocked response isn't playable
    if (!VALID_PLAYABILITY_STATUSES.includes((_unlockedPlayerRespon = unlockedPlayerResponse.playabilityStatus) === null || _unlockedPlayerRespon === void 0 ? void 0 : _unlockedPlayerRespon.status)) {var _unlockedPlayerRespon2;
      Toast.show(`${messagesMap.fail} (PlayabilityError)`, 10);
      throw new Error(`Player Unlock Failed, playabilityStatus: ${(_unlockedPlayerRespon2 = unlockedPlayerResponse.playabilityStatus) === null || _unlockedPlayerRespon2 === void 0 ? void 0 : _unlockedPlayerRespon2.status}`);
    }

    // if the video info was retrieved via proxy, store the URL params from the url-attribute to detect later if the requested video file (googlevideo.com) need a proxy.
    if (unlockedPlayerResponse.proxied && (_unlockedPlayerRespon3 = unlockedPlayerResponse.streamingData) !== null && _unlockedPlayerRespon3 !== void 0 && _unlockedPlayerRespon3.adaptiveFormats) {var _unlockedPlayerRespon4, _unlockedPlayerRespon5;
      const cipherText = (_unlockedPlayerRespon4 = unlockedPlayerResponse.streamingData.adaptiveFormats.find((x) => x.signatureCipher)) === null || _unlockedPlayerRespon4 === void 0 ? void 0 : _unlockedPlayerRespon4.signatureCipher;
      const videoUrl = cipherText ? new URLSearchParams(cipherText).get('url') : (_unlockedPlayerRespon5 = unlockedPlayerResponse.streamingData.adaptiveFormats.find((x) => x.url)) === null || _unlockedPlayerRespon5 === void 0 ? void 0 : _unlockedPlayerRespon5.url;

      lastProxiedGoogleVideoUrlParams = videoUrl ? new URLSearchParams(new URL(videoUrl).search) : null;
    }

    // Overwrite the embedded (preview) playabilityStatus with the unlocked one
    if (playerResponse.previewPlayabilityStatus) {
      playerResponse.previewPlayabilityStatus = unlockedPlayerResponse.playabilityStatus;
    }

    // Transfer all unlocked properties to the original player response
    Object.assign(playerResponse, unlockedPlayerResponse);

    playerResponse.unlocked = true;

    Toast.show(messagesMap.success);
  }

  function getUnlockedPlayerResponse(playerResponse) {var _playerResponse$video2;
    const videoId = ((_playerResponse$video2 = playerResponse.videoDetails) === null || _playerResponse$video2 === void 0 ? void 0 : _playerResponse$video2.videoId) || getYtcfgValue('PLAYER_VARS').video_id;

    // Check if response is cached
    if (cachedPlayerResponse.videoId === videoId) return createDeepCopy(cachedPlayerResponse);

    const unlockStrategies = getPlayerUnlockStrategies(playerResponse);

    let unlockedPlayerResponse = {};

    // Try every strategy until one of them works
    unlockStrategies.every((strategy, index) => {var _unlockedPlayerRespon6, _unlockedPlayerRespon7;
      // Skip if flag set
      if (strategy.skip) return true;

      // Skip strategy if authentication is required and the user is not logged in
      if (strategy.requiresAuth && !isUserLoggedIn()) return true;

      info(`Trying Player Unlock Method #${index + 1} (${strategy.name})`);

      try {
        unlockedPlayerResponse = strategy.getPlayer(strategy.payload, strategy.requiresAuth);
      } catch (err) {
        error(err, `Player Unlock Method ${index + 1} failed with exception`);
      }

      return !VALID_PLAYABILITY_STATUSES.includes((_unlockedPlayerRespon6 = unlockedPlayerResponse) === null || _unlockedPlayerRespon6 === void 0 ? void 0 : (_unlockedPlayerRespon7 = _unlockedPlayerRespon6.playabilityStatus) === null || _unlockedPlayerRespon7 === void 0 ? void 0 : _unlockedPlayerRespon7.status);
    });

    // Cache response to prevent a flood of requests in case youtube processes a blocked response mutiple times.
    cachedPlayerResponse = { videoId, ...createDeepCopy(unlockedPlayerResponse) };

    return unlockedPlayerResponse;
  }

  let cachedNextResponse = {};

  function getNextUnlockStrategies(nextResponse) {
    const videoId = nextResponse.currentVideoEndpoint.watchEndpoint.videoId;
    const clientName = getYtcfgValue('INNERTUBE_CLIENT_NAME') || 'WEB';
    const clientVersion = getYtcfgValue('INNERTUBE_CLIENT_VERSION') || '2.20220203.04.00';
    const hl = getYtcfgValue('HL');

    return [
    // Strategy 1: Retrieve the sidebar and video description from an account proxy server.
    // Session cookies of an age-verified Google account are stored on server side.
    // See https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass/tree/main/account-proxy
    {
      name: 'Account Proxy',
      payload: {
        videoId,
        clientName,
        clientVersion,
        hl,
        isEmbed: +isEmbed,
        isConfirmed: +isConfirmed },

      getNext: getNext }];


  }

  function unlockNextResponse(originalNextResponse) {
    const unlockedNextResponse = getUnlockedNextResponse(originalNextResponse);

    // check if the sidebar of the unlocked response is still empty
    if (isWatchNextSidebarEmpty(unlockedNextResponse)) {
      throw new Error(`Sidebar Unlock Failed`);
    }

    // Transfer some parts of the unlocked response to the original response
    mergeNextResponse(originalNextResponse, unlockedNextResponse);
  }

  function getUnlockedNextResponse(nextResponse) {
    const videoId = nextResponse.currentVideoEndpoint.watchEndpoint.videoId;

    if (!videoId) {
      throw new Error(`Missing videoId in nextResponse`);
    }

    // Check if response is cached
    if (cachedNextResponse.videoId === videoId) return createDeepCopy(cachedNextResponse);

    const unlockStrategies = getNextUnlockStrategies(nextResponse);

    let unlockedNextResponse = {};

    // Try every strategy until one of them works
    unlockStrategies.every((strategy, index) => {
      info(`Trying Sidebar Unlock Method #${index + 1} (${strategy.name})`);

      try {
        unlockedNextResponse = strategy.getNext(strategy.payload);
      } catch (err) {
        error(err, `Sidebar Unlock Method ${index + 1} failed with exception`);
      }

      return isWatchNextSidebarEmpty(unlockedNextResponse);
    });

    // Cache response to prevent a flood of requests in case youtube processes a blocked response mutiple times.
    cachedNextResponse = { videoId, ...createDeepCopy(unlockedNextResponse) };

    return unlockedNextResponse;
  }

  function mergeNextResponse(originalNextResponse, unlockedNextResponse) {var _unlockedNextResponse, _unlockedNextResponse2, _unlockedNextResponse3, _unlockedNextResponse4, _unlockedNextResponse5;
    if (isDesktop) {
      // Transfer WatchNextResults to original response
      originalNextResponse.contents.twoColumnWatchNextResults.secondaryResults = unlockedNextResponse.contents.twoColumnWatchNextResults.secondaryResults;

      // Transfer video description to original response
      const originalVideoSecondaryInfoRenderer = originalNextResponse.contents.twoColumnWatchNextResults.results.results.contents.find(
      (x) => x.videoSecondaryInfoRenderer).
      videoSecondaryInfoRenderer;
      const unlockedVideoSecondaryInfoRenderer = unlockedNextResponse.contents.twoColumnWatchNextResults.results.results.contents.find(
      (x) => x.videoSecondaryInfoRenderer).
      videoSecondaryInfoRenderer;

      if (unlockedVideoSecondaryInfoRenderer.description) originalVideoSecondaryInfoRenderer.description = unlockedVideoSecondaryInfoRenderer.description;

      return;
    }

    // Transfer WatchNextResults to original response
    const unlockedWatchNextFeed = (_unlockedNextResponse = unlockedNextResponse.contents) === null || _unlockedNextResponse === void 0 ? void 0 : (_unlockedNextResponse2 = _unlockedNextResponse.singleColumnWatchNextResults) === null || _unlockedNextResponse2 === void 0 ? void 0 : (_unlockedNextResponse3 = _unlockedNextResponse2.results) === null || _unlockedNextResponse3 === void 0 ? void 0 : (_unlockedNextResponse4 = _unlockedNextResponse3.results) === null || _unlockedNextResponse4 === void 0 ? void 0 : (_unlockedNextResponse5 = _unlockedNextResponse4.contents) === null || _unlockedNextResponse5 === void 0 ? void 0 : _unlockedNextResponse5.find(
    (x) => {var _x$itemSectionRendere;return ((_x$itemSectionRendere = x.itemSectionRenderer) === null || _x$itemSectionRendere === void 0 ? void 0 : _x$itemSectionRendere.targetId) === 'watch-next-feed';});


    if (unlockedWatchNextFeed) originalNextResponse.contents.singleColumnWatchNextResults.results.results.contents.push(unlockedWatchNextFeed);

    // Transfer video description to original response
    const originalStructuredDescriptionContentRenderer = originalNextResponse.engagementPanels.
    find((x) => x.engagementPanelSectionListRenderer).
    engagementPanelSectionListRenderer.content.structuredDescriptionContentRenderer.items.find((x) => x.expandableVideoDescriptionBodyRenderer);
    const unlockedStructuredDescriptionContentRenderer = unlockedNextResponse.engagementPanels.
    find((x) => x.engagementPanelSectionListRenderer).
    engagementPanelSectionListRenderer.content.structuredDescriptionContentRenderer.items.find((x) => x.expandableVideoDescriptionBodyRenderer);

    if (unlockedStructuredDescriptionContentRenderer.expandableVideoDescriptionBodyRenderer)
    originalStructuredDescriptionContentRenderer.expandableVideoDescriptionBodyRenderer = unlockedStructuredDescriptionContentRenderer.expandableVideoDescriptionBodyRenderer;
  }

  function processThumbnails(responseObject) {
    const thumbnails = findNestedObjectsByAttributeNames(responseObject, ['url', 'height']).filter((x) => typeof x.url === 'string' && x.url.indexOf('https://i.ytimg.com/') === 0);
    const blurredThumbnails = thumbnails.filter((thumbnail) => THUMBNAIL_BLURRED_SQPS.some((sqp) => thumbnail.url.includes(sqp)));

    // Simply remove all URL parameters to eliminate the blur effect.
    blurredThumbnails.forEach((x) => x.url = x.url.split('?')[0]);

    info(blurredThumbnails.length + '/' + thumbnails.length + ' thumbnails detected as blurred.');
  }

  try {
    attachInitialDataInterceptor(processYtData);
    attachJsonInterceptor(processYtData);
    attachXhrOpenInterceptor(onXhrOpenCalled);
  } catch (err) {
    error(err, 'Error while attaching data interceptors');
  }

  function processYtData(ytData) {
    try {var _ytData$playabilitySt, _ytData$previewPlayab;
      // Player Unlock #1: Initial page data structure and response from `/youtubei/v1/player` XHR request
      if (isPlayerObject(ytData) && isAgeRestricted(ytData.playabilityStatus)) {
        unlockPlayerResponse(ytData);
      }
      // Player Unlock #2: Embedded Player inital data structure
      else if (isEmbeddedPlayerObject(ytData) && isAgeRestricted(ytData.previewPlayabilityStatus)) {
        unlockPlayerResponse(ytData);
      } else
      if (((_ytData$playabilitySt = ytData.playabilityStatus) === null || _ytData$playabilitySt === void 0 ? void 0 : _ytData$playabilitySt.status) === 'ERROR') {
        ytData.videoDetails = {};
        const urlParams = new URLSearchParams(window.location.search);
        ytData.videoDetails.videoId = urlParams.get('v');
        unlockPlayerResponse(ytData);
      } else
      if (((_ytData$previewPlayab = ytData.previewPlayabilityStatus) === null || _ytData$previewPlayab === void 0 ? void 0 : _ytData$previewPlayab.status) === 'ERROR') {
        unlockPlayerResponse(ytData);
      }
    } catch (err) {
      error(err, 'Video unlock failed');
    }

    try {
      // Unlock sidebar watch next feed (sidebar) and video description
      if (isWatchNextObject(ytData) && isWatchNextSidebarEmpty(ytData)) {
        unlockNextResponse(ytData);
      }

      // Mobile version
      if (isWatchNextObject(ytData.response) && isWatchNextSidebarEmpty(ytData.response)) {
        unlockNextResponse(ytData.response);
      }
    } catch (err) {
      error(err, 'Sidebar unlock failed');
    }

    try {
      // Unlock blurry video thumbnails in search results
      if (isSearchResult(ytData)) {
        processThumbnails(ytData);
      }
    } catch (err) {
      error(err, 'Thumbnail unlock failed');
    }

    return ytData;
  }

  function onXhrOpenCalled(xhr, method, url) {
    if (!isGoogleVideo(method, url)) return;

    if (isGoogleVideoUnlockRequired(url, getLastProxiedGoogleVideoId())) {
      // If the account proxy was used to retrieve the video info, the following applies:
      // some video files (mostly music videos) can only be accessed from IPs in the same country as the innertube api request (/youtubei/v1/player) was made.
      // to get around this, the googlevideo URL will be replaced with a web-proxy URL in the same country (US).
      // this is only required if the "gcr=[countrycode]" flag is set in the googlevideo-url...

      // solve CORS errors by preventing YouTube from enabling the "withCredentials" option (required for the proxy)
      Object.defineProperty(xhr, 'withCredentials', {
        set: () => {},
        get: () => false });


      return getGoogleVideoUrl(url.toString());
    }
  }


})(true);
