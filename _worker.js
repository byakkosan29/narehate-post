/* =========================================================
   NAREHATE POSTAL SERVICE
   _worker.js
   Cloudflare Pages API Gateway
   ========================================================= */


/* =========================================================
   <Start> BACKEND CONFIGURATION
   ========================================================= */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxPHt6-RFMyY1jsdSgDs2JId9LwcFQ8w--PbqZlVE230gGAl_Y2xp0InmC0vF6qINng/exec';


/* =========================================================
   <Finish> BACKEND CONFIGURATION
   ========================================================= */


/* =========================================================
   <Start> CORS HEADERS
   ========================================================= */

const CORS_HEADERS = {

  'Access-Control-Allow-Origin':
    '*',

  'Access-Control-Allow-Methods':
    'GET, POST, OPTIONS',

  'Access-Control-Allow-Headers':
    'Content-Type, Authorization'

};

/* =========================================================
   <Finish> CORS HEADERS
   ========================================================= */


/* =========================================================
   <Start> JSON RESPONSE
   ========================================================= */

function jsonResponse(
  data,
  status = 200
) {

  return new Response(

    JSON.stringify(
      data,
      null,
      2
    ),

    {

      status,

      headers: {

        'Content-Type':
          'application/json; charset=utf-8',

        ...CORS_HEADERS

      }

    }

  );

}

/* =========================================================
   <Finish> JSON RESPONSE
   ========================================================= */


/* =========================================================
   <Start> DEBUG APPS SCRIPT
   ---------------------------------------------------------
   Untuk sementara kita TIDAK mengikuti redirect Google.

   Tujuannya adalah melihat response pertama dari
   Apps Script dan URL redirect yang diberikan Google.

   Ini hanya untuk diagnosis.
   ========================================================= */

async function debugAppsScript() {

  try {

    const response =
      await fetch(

        APPS_SCRIPT_URL,

        {

          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json'

          },

          body:
            JSON.stringify({

              action:
                'status'

            }),

          redirect:
            'manual'

        }

      );


    const location =
      response.headers.get(
        'Location'
      );


    const body =
      await response.text();


    return jsonResponse({

      success:
        true,

      appsScriptStatus:
        response.status,

      appsScriptStatusText:
        response.statusText,

      redirectLocation:
        location,

      responseType:
        response.type,

      responseUrl:
        response.url,

      responseBodyPreview:
        body.substring(
          0,
          500
        )

    });

  }

  catch (error) {

    return jsonResponse(

      {

        success:
          false,

        error:
          error.message ||
          'Apps Script diagnostic failed.'

      },

      500

    );

  }

}

/* =========================================================
   <Finish> DEBUG APPS SCRIPT
   ========================================================= */


/* =========================================================
   <Start> API REQUEST
   --------------------------------------------------------- */

async function proxyToAppsScript(
  request,
  action = null
) {

  try {

    let payload = {};


    if (
      request.method ===
      'POST'
    ) {

      payload =
        await request.json();

    }


    if (action) {

      payload.action =
        action;

    }


    if (!payload.action) {

      return jsonResponse(

        {

          success:
            false,

          error:
            'API action is required.'

        },

        400

      );

    }


    const response =
      await fetch(

        APPS_SCRIPT_URL,

        {

          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json'

          },

          body:
            JSON.stringify(
              payload
            ),

          redirect:
            'follow'

        }

      );


    const responseText =
      await response.text();


    return new Response(

      responseText,

      {

        status:
          response.status,

        headers: {

          'Content-Type':
            response.headers.get(
              'Content-Type'
            ) ||
            'application/json; charset=utf-8',

          ...CORS_HEADERS

        }

      }

    );

  }

  catch (error) {

    return jsonResponse(

      {

        success:
          false,

        error:
          error.message ||
          'Cloudflare API proxy error.'

      },

      500

    );

  }

}

/* =========================================================
   <Finish> API REQUEST
   ========================================================= */


/* =========================================================
   <Start> FETCH HANDLER
   ========================================================= */

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(
        request.url
      );


    /* =======================================
       CORS PREFLIGHT
       ======================================= */

    if (
      request.method ===
      'OPTIONS'
    ) {

      return new Response(

        null,

        {

          status:
            204,

          headers:
            CORS_HEADERS

        }

      );

    }


    /* =======================================
       DEBUG
       ======================================= */

    if (
      url.pathname ===
      '/api/debug'
    ) {

      return debugAppsScript();

    }


    /* =======================================
       MAIN API
       ======================================= */

    if (
      url.pathname ===
      '/api'
    ) {

      return proxyToAppsScript(
        request
      );

    }


    /* =======================================
       STATUS
       ======================================= */

    if (
      url.pathname ===
      '/api/status'
    ) {

      return proxyToAppsScript(
        request,
        'status'
      );

    }


    /* =======================================
       CONFIG
       ======================================= */

    if (
      url.pathname ===
      '/api/config'
    ) {

      return proxyToAppsScript(
        request,
        'config'
      );

    }


    /* =======================================
       SERVER TIME
       ======================================= */

    if (
      url.pathname ===
      '/api/time'
    ) {

      return proxyToAppsScript(
        request,
        'time'
      );

    }


    /* =======================================
       VERSION
       ======================================= */

    if (
      url.pathname ===
      '/api/version'
    ) {

      return proxyToAppsScript(
        request,
        'version'
      );

    }


    /* =======================================
       STATIC FRONTEND
       ======================================= */

    return env.ASSETS.fetch(
      request
    );

  }

};

/* =========================================================
   <Finish> FETCH HANDLER
   ========================================================= */