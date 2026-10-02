

/* =========================================================
   NAREHATE POSTAL SERVICE
   03_JS.html
   Frontend Application Logic
   ========================================================= */





/* =========================================================
   APPLICATION STATE
   ========================================================= */

const APP = {

  config:
    null,

  status:
    null,

  identity:
    null,

  user:
    null,

  googleIdToken:
    null,

   sessionToken:
  null,

sessionExpiresAt:
  null,

  initialized:
    false,

  historyReady:
    false,

  currentView:
    'loading',

  entryView:
    null,

  environment: {

    centralOfficeBackground:
      null,

    doorBackground:
      null,

    registrationBackground:
      null

  }

};

/* =========================================================
   <Finish> APPLICATION STATE
   ========================================================= */




/* =========================================================
   <Start> DOM HELPERS
   ========================================================= */

function getElement(id) {

  return document.getElementById(id);

}

/* =========================================================
   <Finish> DOM HELPERS
   ========================================================= */


/* =========================================================
   <Start> CLOUDFLARE API HELPER
   ---------------------------------------------------------
   Frontend sekarang berjalan sebagai website biasa.

   Semua komunikasi dengan backend dilakukan melalui:
   
       Browser
          ↓
       /api/*
          ↓
       Cloudflare Worker
          ↓
       Apps Script

   Tidak menggunakan google.script lagi.
   ========================================================= */

async function apiRequest(
  action,
  data = {},
  options = {}
) {

  const method =
    options.method ||
    'POST';

  let response;


  try {

    if (method === 'GET') {

      response =
        await fetch(
          '/api/' +
          encodeURIComponent(action),
          {
            method: 'GET',
            headers: {
              'Accept':
                'application/json'
            }
          }
        );

    } else {

      response =
        await fetch(
          '/api',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'Accept':
                'application/json'
            },

            body:
              JSON.stringify({

                action:
                  action,

                ...data

              })
          }
        );

    }

  } catch (error) {

    console.error(
      '[NAREHATE] API NETWORK ERROR:',
      error
    );

    throw new Error(
      'Unable to reach the postal service.'
    );

  }


  let result;

  try {

    result =
      await response.json();

  } catch (error) {

    console.error(
      '[NAREHATE] API INVALID RESPONSE:',
      error
    );

    throw new Error(
      'The postal service returned an invalid response.'
    );

  }


  if (!response.ok) {

    throw new Error(
      result &&
      result.error
        ? result.error
        : 'Postal service request failed.'
    );

  }


  return result;

}

/* =========================================================
   <Finish> CLOUDFLARE API HELPER
   ========================================================= */



/* =========================================================
   <Start> NAREHATE SESSION MANAGEMENT
   ---------------------------------------------------------
   Server-side session berlangsung 1 jam.

   Browser hanya menyimpan:
      - sessionToken
      - expiresAt

   Password dan Google ID Token TIDAK disimpan sebagai
   persistent login credential.
   ========================================================= */

const NAREHATE_SESSION_KEY =
  'NAREHATE_SESSION';


function saveNarehateSession(
  sessionToken,
  expiresAt
) {

  if (
    !sessionToken
  ) {

    return false;

  }


  const session = {

    sessionToken:
      sessionToken,

    expiresAt:
      expiresAt || null

  };


  try {

    localStorage.setItem(
      NAREHATE_SESSION_KEY,
      JSON.stringify(session)
    );

  } catch (
    error
  ) {

    console.error(
      '[NAREHATE] Could not save session.',
      error
    );

    return false;

  }


  APP.sessionToken =
    sessionToken;

  APP.sessionExpiresAt =
    expiresAt || null;


  return true;

}


function loadNarehateSession() {

  try {

    const raw =
      localStorage.getItem(
        NAREHATE_SESSION_KEY
      );


    if (
      !raw
    ) {

      return null;

    }


    const session =
      JSON.parse(raw);


    if (
      !session ||
      !session.sessionToken
    ) {

      localStorage.removeItem(
        NAREHATE_SESSION_KEY
      );

      return null;

    }


    APP.sessionToken =
      session.sessionToken;

    APP.sessionExpiresAt =
      session.expiresAt || null;


    return session;

  } catch (
    error
  ) {

    console.warn(
      '[NAREHATE] Invalid stored session.'
    );


    clearNarehateSession();

    return null;

  }

}


function clearNarehateSession() {

  try {

    localStorage.removeItem(
      NAREHATE_SESSION_KEY
    );

  } catch (
    error
  ) {

    console.warn(
      '[NAREHATE] Could not clear stored session.',
      error
    );

  }


  APP.sessionToken =
    null;

  APP.sessionExpiresAt =
    null;

}


/* =========================================================
   <Finish> NAREHATE SESSION MANAGEMENT
   ========================================================= */


/* =========================================================
   <Start> RESTORE NAREHATE SESSION
   ---------------------------------------------------------
   Saat browser reload:

      localStorage
           ↓
      sessionToken
           ↓
      sessionvalidate
           ↓
      valid?
        YES → restore user
        NO  → clear session → Gate
   ========================================================= */

async function restoreNarehateSession() {

  const session =
    loadNarehateSession();


  if (
    !session
  ) {

    return false;

  }


  try {

    const result =
      await apiRequest(
        'sessionvalidate',
        {
          sessionToken:
            session.sessionToken
        }
      );


    if (
      !result ||
      result.success !== true
    ) {

      clearNarehateSession();

      return false;

    }


    /*
     * Restore authenticated identity.
     */

    if (
      result.user
    ) {

      APP.user =
        result.user;

    }


    APP.identity = {

      success:
        true,

      authenticated:
        true,

      registered:
        true,

      needsRegistration:
        false,

      user:
        result.user || null

    };


    /*
     * Backend adalah authority.
     * Jangan percaya expiry dari localStorage
     * sebagai satu-satunya validasi.
     */

    updateDebugPanel();


    console.log(
      '[NAREHATE] Existing correspondent session restored.'
    );


    return true;

  } catch (
    error
  ) {

    console.warn(
      '[NAREHATE] Stored session could not be restored.',
      error
    );


    clearNarehateSession();

    return false;

  }

}


/* =========================================================
   <Start> UPDATE LOADING STATUS
   ---------------------------------------------------------
   Mengontrol text dan progress visual pada loading screen.
   ========================================================= */

const LOADING_STEPS = [

  {
    text:
      'Initializing postal service...',
    progress:
      18
  },

  {
    text:
      'Establishing correspondence routes...',
    progress:
      36
  },

  {
    text:
      'Contacting the central office...',
    progress:
      54
  },

  {
    text:
      'Preparing the postal registry...',
    progress:
      72
  },

  {
    text:
      'Preparing your correspondence...',
    progress:
      88
  },

  {
    text:
      'Postal service ready.',
    progress:
      100
  }

];


let loadingStepIndex =
  0;


let loadingStepTimer =
  null;


function setLoadingStatus(
  message
) {

  const element =
    getElement(
      'loading-status'
    );


  if (element) {

    element.textContent =
      message;

  }

}


function setLoadingProgress(
  progress
) {

  const element =
    getElement(
      'loading-progress-bar'
    );


  if (!element) {

    return;

  }


  const safeProgress =
    Math.max(
      0,
      Math.min(
        100,
        Number(progress) || 0
      )
    );


  element.style.width =
    safeProgress + '%';

}


function updateLoadingStep() {

  const step =
    LOADING_STEPS[
      loadingStepIndex
    ];


  if (!step) {

    return;

  }


  const status =
    getElement(
      'loading-status'
    );


  if (status) {

    status.style.opacity =
      '0';


    window.setTimeout(
      function() {

        status.textContent =
          step.text;

        status.style.opacity =
          '1';

      },
      180
    );

  }


  setLoadingProgress(
    step.progress
  );


  loadingStepIndex =
    Math.min(
      loadingStepIndex + 1,
      LOADING_STEPS.length - 1
    );

}


function startLoadingAnimation() {

  if (
    loadingStepTimer
  ) {

    return;

  }


  loadingStepIndex =
    0;


  updateLoadingStep();


  loadingStepTimer =
    window.setInterval(
      function() {

        if (
          loadingStepIndex >=
          LOADING_STEPS.length
        ) {

          return;

        }


        updateLoadingStep();

      },
      900
    );

}


function stopLoadingAnimation() {

  if (
    !loadingStepTimer
  ) {

    return;

  }


  window.clearInterval(
    loadingStepTimer
  );


  loadingStepTimer =
    null;

}


/* =========================================================
   <Finish> UPDATE LOADING STATUS
   ========================================================= */


/* =========================================================
   <Start> SHOW MAIN APPLICATION
   ========================================================= */

function showMainApplication() {

  const loadingScreen =
    getElement('loading-screen');

  const mainApp =
    getElement('main-app');


  if (loadingScreen) {

    loadingScreen.classList.add(
      'is-hidden'
    );

  }


  if (mainApp) {

    mainApp.classList.remove(
      'is-hidden'
    );

  }

}

/* =========================================================
   <Finish> SHOW MAIN APPLICATION
   ========================================================= */


/* =========================================================
   <Start> LOAD PUBLIC CONFIG
   ========================================================= */

async function loadPublicConfig() {

  const result =
    await apiRequest(
      'config',
      {},
      {
        method:
          'GET'
      }
    );


  APP.config =
    result;


  return result;

}

/* =========================================================
   <Finish> LOAD PUBLIC CONFIG
   ========================================================= */

/* =========================================================
   <Start> LOAD CENTRAL OFFICE BACKGROUND
   ---------------------------------------------------------
   Mengambil artwork Central Office melalui Cloudflare API.

   Flow:

   Browser
      ↓
   Cloudflare Worker
      ↓
   Apps Script
      ↓
   Google Drive
      ↓
   Base64 Image Data
   ========================================================= */

async function loadCentralOfficeBackground() {

  const imageData =
    await apiRequest(
      'centralOfficeBackground'
    );


  APP.environment
    .centralOfficeBackground =
    imageData;


  return imageData;

}

/* =========================================================
   <Finish> LOAD CENTRAL OFFICE BACKGROUND
   ========================================================= */


/* <Start> BLOCK 60 — APPLY CENTRAL OFFICE BACKGROUND */

/* =========================================================
   APPLY CENTRAL OFFICE BACKGROUND
   ---------------------------------------------------------
   Central Office artwork sekarang berasal langsung dari
   Cloudflare Pages.

   Tidak lagi bergantung pada Google Drive / Apps Script.
   ========================================================= */

function applyCentralOfficeBackground() {

  const environment =
    getElement(
      'environment-background'
    );


  if (!environment) {

    console.warn(
      '[NAREHATE] Central Office background element not found.'
    );

    return;

  }


  const backgroundUrl =
    '/assets/environments/main_office.webp';


  environment.style.backgroundImage =
    'url("' +
    backgroundUrl +
    '")';


  console.log(
    '[NAREHATE] Central Office artwork applied:',
    backgroundUrl
  );

}

/* <Finish> BLOCK 60 — APPLY CENTRAL OFFICE BACKGROUND */

/* =========================================================
   <Start> LOAD SERVER STATUS
   ========================================================= */

async function loadServerStatus() {

  const result =
    await apiRequest(
      'status',
      {},
      {
        method:
          'GET'
      }
    );


  APP.status =
    result;


  return result;

}

/* =========================================================
   <Finish> LOAD SERVER STATUS
   ========================================================= */



/* =========================================================
   <Start> LOAD CURRENT USER
   ---------------------------------------------------------
   User identity menggunakan Google ID Token.

   Flow:

   Google
      ↓
   ID Token
      ↓
   Cloudflare API
      ↓
   Apps Script
      ↓
   verifyGoogleIdToken()
      ↓
   USERS / GOOGLE_SUB

   Jika backend gagal, error asli dari server
   diteruskan ke frontend agar mudah didiagnosis.
   ========================================================= */

async function loadCurrentUser() {

  /*
   * Tidak ada Google identity berarti belum
   * mendapatkan authentication token.
   */

  if (!APP.googleIdToken) {

    APP.identity = {

      authenticated:
        false,

      registered:
        false,

      user:
        null

    };

    APP.user =
      null;

    return APP.identity;

  }


  /*
   * Kirim Google ID Token ke backend.
   */

  const result =
    await apiRequest(
      'auth',
      {
        idToken:
          APP.googleIdToken
      }
    );


  /*
   * DEBUG:
   * tampilkan response mentah dari backend.
   */

 console.log(
  '[NAREHATE] AUTH RESPONSE:',
  {
    success:
      result &&
      result.success === true,

    authenticated:
      result &&
      result.authenticated === true,

    registered:
      result &&
      result.registered === true,

    hasSession:
      !!(
        result &&
        result.sessionToken
      )
  }
);


  /*
   * Kalau backend mengembalikan error,
   * jangan lanjut dengan identity palsu.
   *
   * Teruskan pesan error asli supaya kita tahu
   * apakah masalahnya:
   *
   * - token invalid
   * - audience mismatch
   * - token expired
   * - Google verification gagal
   * - Apps Script error
   * - database error
   */

  if (
    !result ||
    result.success !== true
  ) {

    throw new Error(
      result &&
      result.error
        ? result.error
        : 'Authentication server returned an invalid response.'
    );

  }

if (
  result &&
  result.success === true &&
  result.sessionToken
) {

  saveNarehateSession(
    result.sessionToken,
    result.expiresAt
  );

}







   
  /*
   * Simpan identity hasil authentication.*/

  APP.identity =
    result;


  /*
   * Simpan user jika sudah terdaftar.
   */

  if (
    result.user
  ) {

    APP.user =
      result.user;

  } else {

    APP.user =
      null;

  }


  /*
   * Return identity ke authentication flow.
   */

  return result;

}

/* =========================================================
   <Finish> LOAD CURRENT USER
   ========================================================= */



/* =========================================================
   GOOGLE IDENTITY SERVICES
   ---------------------------------------------------------
   Menyiapkan Google Sign-In.

   IMPORTANT:
   Function ini hanya bertugas menyiapkan Google.

   Function TIDAK menunggu user login.

   Setelah Google button siap:
       resolve()

   Ketika user benar-benar login:
       handleGoogleCredential()
       ↓
       handleGoogleAuthentication()
   ========================================================= */

function initializeGoogleIdentity() {

  return new Promise(
    function(
      resolve,
      reject
    ) {

      const maxAttempts =
        100;

      let attempts =
        0;


      function tryInitialize() {

        attempts++;


        /*
         * -----------------------------------------
         * WAIT FOR GOOGLE IDENTITY SERVICES
         * -----------------------------------------
         */

        if (
          !window.google ||
          !google.accounts ||
          !google.accounts.id
        ) {

          if (
            attempts >=
            maxAttempts
          ) {

            reject(
              new Error(
                'Google Identity Services did not load.'
              )
            );

            return;

          }


          setTimeout(
            tryInitialize,
            100
          );

          return;

        }


        /*
         * -----------------------------------------
         * CLIENT ID
         * -----------------------------------------
         */

        const clientId =
          APP.config &&
          APP.config.googleClientId;


        if (
          !clientId
        ) {

          reject(
            new Error(
              'Google Client ID is not configured.'
            )
          );

          return;

        }


        /*
         * -----------------------------------------
         * GOOGLE CALLBACK
         * -----------------------------------------
         */

        function handleGoogleCredential(
          response
        ) {

          if (
            !response ||
            !response.credential
          ) {

            console.error(
              '[NAREHATE] Google returned no credential.'
            );

            return;

          }


          /*
           * Simpan ID Token sementara.
           */

          APP.googleIdToken =
            response.credential;


          /*
           * Authentication berjalan
           * setelah credential diterima.
           */

          handleGoogleAuthentication()

            .then(
              function() {

                removeGoogleSignInButton();

              }
            )

            .catch(
              function(error) {

                console.error(
                  '[NAREHATE] Google authentication failed:',
                  error
                );


                const status =
                  getElement(
                    'gate-auth-status'
                  );


                if (
                  status
                ) {

                  status.textContent =
                    error.message ||
                    'Google authentication failed.';

                  status.classList.add(
                    'is-error'
                  );

                }

              }
            );

        }


        /*
         * -----------------------------------------
         * INITIALIZE GOOGLE
         * -----------------------------------------
         */

        google.accounts.id.initialize({

          client_id:
            clientId,

          callback:
            handleGoogleCredential,

          ux_mode:
            'popup',

          auto_select:
            false

        });


        /*
         * -----------------------------------------
         * GOOGLE BUTTON CONTAINER
         * -----------------------------------------
         */

        const buttonContainer =
          createGoogleSignInContainer();


        if (
          !buttonContainer
        ) {

          reject(
            new Error(
              'Google Sign-In container could not be created.'
            )
          );

          return;

        }


        /*
         * -----------------------------------------
         * RENDER GOOGLE BUTTON
         * -----------------------------------------
         */

        google.accounts.id.renderButton(

          buttonContainer,

          {

            type:
              'standard',

            theme:
              'outline',

            size:
              'large',

            text:
              'signin_with',

            shape:
              'rectangular',

            logo_alignment:
              'left',

            width:
              320,

            use_fedcm_for_button:
              false

          }

        );


        /*
         * -----------------------------------------
         * GOOGLE IS READY
         * -----------------------------------------
         *
         * IMPORTANT:
         * Resolve SEKARANG.
         *
         * Jangan menunggu Google credential.
         */

        console.log(
          '[NAREHATE] Google Sign-In button ready.'
        );


        resolve(
          true
        );

      }


      /*
       * Mulai initialization.
       */

      tryInitialize();

    }
  );

}




/* =========================================================
   <Start> CREATE GOOGLE SIGN-IN CONTAINER
   ---------------------------------------------------------
   Menggunakan container yang sudah tersedia di
   Correspondence Gate.

   Tidak membuat floating authentication button.
   ========================================================= */

function createGoogleSignInContainer() {

  const wrapper =
    getElement(
      'google-signin-container'
    );


  if (!wrapper) {

    console.warn(
      '[NAREHATE] Google Sign-In container not found.'
    );

    return null;

  }


  /*
   * Pastikan container bersih sebelum
   * Google Identity Services merender button.
   */

  wrapper.innerHTML =
    '';


  return wrapper;

}


/* =========================================================
   <Start> REMOVE GOOGLE SIGN-IN CONTAINER
   ---------------------------------------------------------
   Setelah authentication berhasil, button dibersihkan
   dari Correspondence Gate.
   ========================================================= */

function removeGoogleSignInButton() {

  const wrapper =
    getElement(
      'google-signin-container'
    );


  if (wrapper) {

    wrapper.innerHTML =
      '';

  }

}


/* =========================================================
   <Finish> REMOVE GOOGLE SIGN-IN CONTAINER
   ========================================================= */


/* =========================================================
   <Finish> CREATE GOOGLE SIGN-IN CONTAINER
   ========================================================= */


/* =========================================================
   <Finish> GOOGLE IDENTITY SERVICES
   ========================================================= */

/* =========================================================
   <Start> GOOGLE AUTHENTICATION FLOW
   ---------------------------------------------------------
   Setelah Google memberikan ID Token:

   Loading
      ↓
   THE POST OFFICE / LOGIN
      ↓
   Google Authentication
      ↓
   Registered?
      ├─ YES → Central Office
      └─ NO  → Registration

   Tidak ada Door kedua setelah login.
   Halaman login itu sendiri adalah Door.
   ========================================================= */

async function handleGoogleAuthentication() {

  setLoadingStatus(
    'Checking correspondent registry...'
  );


  const identity =
    await loadCurrentUser();


  updateDebugPanel();


   /* <Start> BLOCK 64 — GOOGLE NEW USER REGISTRATION REDIRECT */

/* -------------------------------------------------------
   USER BARU
   -------------------------------------------------------
   Google berhasil authenticated tetapi belum memiliki
   account Narehate.

   Registration sekarang merupakan halaman terpisah:
   /registration.html

   Google ID Token disimpan sementara di sessionStorage
   agar tidak pernah masuk ke URL.
   ------------------------------------------------------- */

if (
  identity &&
  identity.authenticated &&
  !identity.registered
) {

  console.log(
    '[NAREHATE] Authenticated Google user is not registered.'
  );


  /*
   * Simpan Google ID Token sementara.
   *
   * Token tidak dimasukkan ke URL karena URL dapat
   * tersimpan di browser history, logs, analytics,
   * atau referrer.
   */

  if (
    APP.googleIdToken
  ) {

    sessionStorage.setItem(
      'NAREHATE_GOOGLE_ID_TOKEN',
      APP.googleIdToken
    );

  }


  /*
   * Pindah ke halaman registration resmi.
   */

  window.location.href =
    '/registration.html';


  return;

}

/* <Finish> BLOCK 64 — GOOGLE NEW USER REGISTRATION REDIRECT */


  /* -------------------------------------------------------
     USER SUDAH TERDAFTAR
     ------------------------------------------------------- */

  if (
    identity &&
    identity.authenticated &&
    identity.registered
  ) {

    console.log(
      '[NAREHATE] Registered correspondent found.'
    );


    /*
     * Login page / Door sudah selesai.
     *
     * Sekarang langsung siapkan Central Office
     * dan buka Office.
     */

    await prepareApplication();


    enterNarehate();


    return;

  }


  /* -------------------------------------------------------
     AUTHENTICATION TIDAK VALID
     ------------------------------------------------------- */

  throw new Error(
    'Google authentication did not produce a valid correspondent identity.'
  );

}

/* =========================================================
   <Finish> GOOGLE AUTHENTICATION FLOW
   ========================================================= */


async function prepareApplication() {

  setLoadingStatus(
    'Opening Central Office...'
  );


  await loadCentralOfficeBackground();


  updateServerStatus(
    APP.status
  );


  updateDebugPanel();


  applyCentralOfficeBackground();


  bindEvents();


  bindEnvironmentHotspots();


  initializeApplicationHistory();


  APP.initialized =
    true;


  setLoadingStatus(
    'Correspondence established.'
  );

}


/* =========================================================
   <Start> ENVIRONMENT NAVIGATION
   ---------------------------------------------------------
   Mengatur perpindahan antara:

   Loading
      ↓
   Registration
      ↓
   Door
      ↓
   Central Office
   ========================================================= */


/* =========================================================
   SHOW REGISTRATION ENVIRONMENT
   ========================================================= */

function showRegistrationEnvironment() {

  const loading =
    getElement('loading-screen');

  const mainApp =
    getElement('main-app');

  const door =
    getElement('door-environment');

  const registration =
    getElement('registration-environment');

  const office =
    getElement('environment-view');


  /*
   * Pastikan application shell sudah terlihat.
   */

  if (loading) {

    loading.classList.add(
      'is-hidden'
    );

  }


  if (mainApp) {

    mainApp.classList.remove(
      'is-hidden'
    );

  }


  /*
   * Sembunyikan environment lain.
   */

  if (door) {

    door.classList.add(
      'is-hidden'
    );

  }


  if (office) {

    office.classList.add(
      'is-hidden'
    );

  }


  /*
   * Tampilkan Registration.
   */

  if (registration) {

    registration.classList.remove(
      'is-hidden'
    );

  }


  APP.currentView =
    'registration';


  bindRegistrationEvents();


  console.log(
    '[NAREHATE] Registration environment opened.'
  );

}


/* =========================================================
   SHOW DOOR ENVIRONMENT
   ========================================================= */

function showDoorEnvironment() {

  const loading =
    getElement('loading-screen');

  const mainApp =
    getElement('main-app');

  const door =
    getElement('door-environment');

  const registration =
    getElement('registration-environment');

  const office =
    getElement('environment-view');


  /*
   * Pastikan application shell sudah terlihat.
   */

  if (loading) {

    loading.classList.add(
      'is-hidden'
    );

  }


  if (mainApp) {

    mainApp.classList.remove(
      'is-hidden'
    );

  }


  /*
   * Sembunyikan environment lain.
   */

  if (registration) {

    registration.classList.add(
      'is-hidden'
    );

  }


  if (office) {

    office.classList.add(
      'is-hidden'
    );

  }


  /*
   * Tampilkan Door.
   */

  if (door) {

    door.classList.remove(
      'is-hidden'
    );

  }


  APP.currentView =
    'door';


  bindDoorEvents();


  console.log(
    '[NAREHATE] Door environment opened.'
  );

}


/* =========================================================
   <Start> ENTER NAREHATE
   ---------------------------------------------------------
   Membuka Central Office setelah authentication berhasil.

   Correspondence Gate adalah halaman login.
   Setelah authentication selesai, Gate harus ditutup
   agar Central Office menjadi satu-satunya view aktif.
   ========================================================= */

function enterNarehate() {

  const loading =
    getElement(
      'loading-screen'
    );


  const correspondenceGate =
    getElement(
      'correspondence-gate'
    );


  const door =
    getElement(
      'door-environment'
    );


  const registration =
    getElement(
      'registration-environment'
    );


  const office =
    getElement(
      'environment-view'
    );


  /* -------------------------------------------------------
     HIDE LOADING
     ------------------------------------------------------- */

  if (loading) {

    loading.classList.add(
      'is-hidden'
    );

  }


  /* -------------------------------------------------------
     HIDE CORRESPONDENCE GATE
     ------------------------------------------------------- */

  if (correspondenceGate) {

    correspondenceGate.classList.add(
      'is-hidden'
    );

  }


  /* -------------------------------------------------------
     HIDE LEGACY DOOR
     ------------------------------------------------------- */

  if (door) {

    door.classList.add(
      'is-hidden'
    );

  }


  /* -------------------------------------------------------
     HIDE REGISTRATION
     ------------------------------------------------------- */

  if (registration) {

    registration.classList.add(
      'is-hidden'
    );

  }


  /* -------------------------------------------------------
     SHOW CENTRAL OFFICE
     ------------------------------------------------------- */

  if (office) {

    office.classList.remove(
      'is-hidden'
    );

  }


  /* -------------------------------------------------------
     UPDATE APPLICATION STATE
     ------------------------------------------------------- */

  APP.currentView =
    'office';


  initializeApplicationHistory();


  bindEnvironmentHotspots();


  console.log(
    '[NAREHATE] Entered Central Office.'
  );

}


/* =========================================================
   <Finish> ENTER NAREHATE
   ========================================================= */

/* =========================================================
   <Finish> ENVIRONMENT NAVIGATION
   ========================================================= */

/* =========================================================
   <Start> DOOR EVENTS
   ---------------------------------------------------------
   Menghubungkan tombol pada Door Environment.

   Flow:

       Door
        ↓
       ENTER NAREHATE
        ↓
       Central Office
   ========================================================= */

function bindDoorEvents() {

  /*
   * Hindari binding dua kali.
   */

  if (
    window.__narehateDoorEventsBound
  ) {

    return;

  }


  const enterButton =
    getElement(
      'enter-narehate'
    );


  if (!enterButton) {

    console.warn(
      '[NAREHATE] Enter button not found.'
    );

    return;

  }


  window.__narehateDoorEventsBound =
    true;


  enterButton.addEventListener(
    'click',
    function() {

      enterNarehate();

    }
  );


  console.log(
    '[NAREHATE] Door events ONLINE.'
  );

}


/* =========================================================
   <Finish> DOOR EVENTS
   ========================================================= */


/* =========================================================
   <Start> REGISTRATION EVENTS
   ---------------------------------------------------------
   Registration form:

       Username
       Display Name
       Postal Name
       Country
       Address

   Google account / email tidak diambil dari form.

   Identitas Google sudah diverifikasi sebelumnya oleh
   authentication flow.
   ========================================================= */

function bindRegistrationEvents() {

  /*
   * Hindari binding dua kali.
   */

  if (
    window.__narehateRegistrationEventsBound
  ) {

    return;

  }


  const form =
    getElement(
      'registration-form'
    );


  const status =
    getElement(
      'registration-status'
    );


  if (!form) {

    console.warn(
      '[NAREHATE] Registration form not found.'
    );

    return;

  }


  window.__narehateRegistrationEventsBound =
    true;


  form.addEventListener(
    'submit',
    async function(event) {

      event.preventDefault();


      /*
       * Ambil field.
       */

      const username =
        getElement(
          'registration-username'
        );

      const displayName =
        getElement(
          'registration-display-name'
        );

      const postalName =
        getElement(
          'registration-postal-name'
        );

      const country =
        getElement(
          'registration-country'
        );

      const address =
        getElement(
          'registration-address'
        );

      const submitButton =
        getElement(
          'registration-submit'
        );


      /*
       * Validasi element.
       */

      if (
        !username ||
        !displayName ||
        !postalName ||
        !country ||
        !address ||
        !submitButton
      ) {

        console.error(
          '[NAREHATE] Registration form is incomplete.'
        );

        return;

      }


      /*
       * Ambil nilai.
       */

      const usernameValue =
        username.value
          .trim()
          .toLowerCase();

      const displayNameValue =
        displayName.value
          .trim();

      const postalNameValue =
        postalName.value
          .trim();

      const countryValue =
        country.value
          .trim();

      const addressValue =
        address.value
          .trim();


      /*
       * Validasi frontend dasar.
       */

      if (!usernameValue) {

        showRegistrationStatus(
          'Username is required.',
          true
        );

        username.focus();

        return;

      }


      if (!displayNameValue) {

        showRegistrationStatus(
          'Display name is required.',
          true
        );

        displayName.focus();

        return;

      }


      /*
       * Username harus mengikuti format:
       *
       * 3–24 karakter
       * lowercase
       * angka
       * underscore
       * titik
       */

      const usernamePattern =
        /^[a-z0-9_.]{3,24}$/;


      if (
        !usernamePattern.test(
          usernameValue
        )
      ) {

        showRegistrationStatus(
          'Username must be 3–24 characters using lowercase letters, numbers, dots or underscores.',
          true
        );

        username.focus();

        return;

      }


      /*
       * Lock UI selama request.
       */

      submitButton.disabled =
        true;

      submitButton.textContent =
        'REGISTERING...';


      showRegistrationStatus(
        'Registering correspondent...',
        false
      );


      try {

        /*
         * Kirim hanya data profile.
         *
         * Email dan Google identity TIDAK dikirim
         * dari frontend.
         */

        const result =
          await registerCorrespondentFromServer({

            username:
              usernameValue,

            displayName:
              displayNameValue,

            postalName:
              postalNameValue,

            country:
              countryValue,

            address:
              addressValue

          });


        /*
         * Backend berhasil.
         */

        if (
          !result ||
          result.success !== true
        ) {

          throw new Error(
            'Registration could not be completed.'
          );

        }


        /*
         * Simpan user yang baru dibuat.
         */

        APP.user =
          result.user || null;


        /*
         * Ambil ulang identity dari server
         * supaya APP.identity konsisten.
         */

        const identity =
          await loadCurrentUser();


        APP.identity =
          identity;


        updateDebugPanel();


        showRegistrationStatus(
          'Correspondent registration complete.',
          false
        );


        /*
         * Persiapkan Central Office.
         */

        await prepareApplication();


        /*
         * Setelah registration selesai,
         * user masuk ke Door.
         */

        showDoorEnvironment();


      } catch (error) {

        console.error(
          '[NAREHATE] REGISTRATION ERROR:',
          error
        );


        showRegistrationStatus(
          error.message ||
            'Registration failed.',
          true
        );


      } finally {

        submitButton.disabled =
          false;

        submitButton.textContent =
          'REGISTER';

      }

    }
  );


  console.log(
    '[NAREHATE] Registration events ONLINE.'
  );

}


/* =========================================================
   <Start> REGISTRATION SERVER CALL
   ---------------------------------------------------------
   Wrapper frontend untuk Cloudflare API.

   Cloudflare:
       POST /api

   Apps Script:
       registerCorrespondent(
         idToken,
         data
       )
   ========================================================= */

async function registerCorrespondentFromServer(
  data
) {

  if (!APP.googleIdToken) {

    throw new Error(
      'Google authentication belum tersedia.'
    );

  }


  const response =
    await apiRequest(
      'register',
      {

        idToken:
          APP.googleIdToken,

        data:
          data

      }
    );


  if (!response) {

    throw new Error(
      'Server tidak memberikan response.'
    );

  }


  if (!response.success) {

    throw new Error(
      response.error ||
      'Registrasi gagal.'
    );

  }


  return response;

}

/* =========================================================
   <Finish> REGISTRATION SERVER CALL
   ========================================================= */


/* =========================================================
   <Start> REGISTRATION STATUS
   ========================================================= */

function showRegistrationStatus(
  message,
  isError
) {

  const status =
    getElement(
      'registration-status'
    );


  if (!status) {

    return;

  }


  status.textContent =
    message;


  status.classList.toggle(
    'is-error',
    !!isError
  );


  status.classList.toggle(
    'is-success',
    !isError
  );

}


/* =========================================================
   <Finish> REGISTRATION STATUS
   ========================================================= */


/* =========================================================
   <Finish> REGISTRATION EVENTS
   ========================================================= */


/* =========================================================
   <Start> UPDATE UI STATUS
   ========================================================= */

function updateServerStatus(status) {

  const label =
    getElement('server-status');

  const dot =
    getElement('server-status-dot');


  if (!status) {

    return;

  }


  if (status.success) {

    if (label) {

      label.textContent =
        'Online';

    }

    if (dot) {

      dot.classList.add(
        'is-online'
      );

    }

  } else {

    if (label) {

      label.textContent =
        'Offline';

    }

  }

}

/* =========================================================
   <Finish> UPDATE UI STATUS
   ========================================================= */


/* =========================================================
   <Start> UPDATE DEBUG PANEL
   ---------------------------------------------------------
   Panel ini hanya sementara selama development.
   ========================================================= */

function updateDebugPanel() {

  const appName =
    getElement('debug-app-name');

  const appVersion =
    getElement('debug-app-version');

  const server =
    getElement('debug-server');

  const identity =
    getElement('debug-identity');


  if (
    appName &&
    APP.config
  ) {

    appName.textContent =
      APP.config.appName || '—';

  }


  if (
    appVersion &&
    APP.config
  ) {

    appVersion.textContent =
      APP.config.appVersion || '—';

  }


  if (
    server &&
    APP.status
  ) {

    server.textContent =
      APP.status.status || '—';

  }


  if (
    identity &&
    APP.identity
  ) {

    if (
      APP.identity.authenticated
    ) {

      if (
        APP.identity.registered
      ) {

        identity.textContent =
          'Registered';

      } else {

        identity.textContent =
          'Authenticated';

      }

    } else {

      identity.textContent =
        'Guest';

    }

  }


  updateCorrespondentGreeting();

}

/* =========================================================
   <Finish> UPDATE DEBUG PANEL
   ========================================================= */


/* =========================================================
   <Start> CORRESPONDENT GREETING
   ========================================================= */

function updateCorrespondentGreeting() {

  const greeting =
    getElement(
      'correspondent-greeting'
    );


  if (!greeting) {

    return;

  }


  if (
    APP.user &&
    APP.user.POSTAL_NAME
  ) {

    greeting.textContent =
      'Correspondent ' +
      APP.user.POSTAL_NAME;

    return;

  }


  if (
    APP.user &&
    APP.user.DISPLAY_NAME
  ) {

    greeting.textContent =
      'Correspondent ' +
      APP.user.DISPLAY_NAME;

    return;

  }


  if (
    APP.identity &&
    APP.identity.authenticated
  ) {

    greeting.textContent =
      'Registered Correspondent';

    return;

  }


  greeting.textContent =
    'Visitor';

}

/* =========================================================
   <Finish> CORRESPONDENT GREETING
   ========================================================= */


/* =========================================================
   <Start> ENTER CENTRAL OFFICE
   ---------------------------------------------------------
   Central Office sekarang menjadi halaman utama setelah
   application boot.

   Fungsi ini tetap dipertahankan sebagai compatibility
   layer jika nanti ada tombol / CTA yang membutuhkan
   kembali ke Central Office.
   ========================================================= */

function enterCentralOffice() {

  const office =
    getElement('central-office');

  const room =
    getElement('room-view');


  if (room) {

    room.classList.add(
      'is-hidden'
    );

  }


  if (office) {

    office.classList.remove(
      'is-hidden'
    );

  }

}

/* =========================================================
   <Finish> ENTER CENTRAL OFFICE
   ========================================================= */



   /* =========================================================
   <Start> ROOM DEFINITIONS
   ---------------------------------------------------------
   Semua interactive destinations Central Office.

   Room baru bisa ditambahkan di sini tanpa mengubah
   hotspot engine.
   ========================================================= */

const ROOMS = {

  map: {

    number:
      '01',

    title:
      'Map Room',

    status:
      'CARTOGRAPHY DEPARTMENT',

    description:
      'Routes, places and roads that may or may not exist.'

  },


  teller: {

    number:
      '02',

    title:
      'Teller',

    status:
      'CORRESPONDENCE DEPARTMENT',

    description:
      'Where letters are received, registered and dispatched.'

  },


  archives: {

    number:
      '03',

    title:
      'Archives',

    status:
      'ARCHIVE DEPARTMENT',

    description:
      'Records of correspondence, events and places from another time.'

  },


  'dead-letter': {

    number:
      '04',

    title:
      'Dead Letter Office',

    status:
      'UNDELIVERABLE CORRESPONDENCE',

    description:
      'Letters whose destination could not be found.'

  },


  notices: {

    number:
      '05',

    title:
      'Notice Board',

    status:
      'PUBLIC INFORMATION',

    description:
      'Announcements, warnings, schedules and ordinary public notices.'

  },


  dispatch: {

    number:
      '06',

    title:
      'Central Dispatch',

    status:
      'CENTRAL DISPATCH DESK',

    description:
      'The working desk where correspondence passes through the office.'

  },


  portal: {

    number:
      '07',

    title:
      'Correspondent Portal',

    status:
      'CORRESPONDENT REGISTRY',

    description:
      'Your personal correspondence record and subscription.'

  }

};

/* =========================================================
   <Finish> ROOM DEFINITIONS
   ========================================================= */


/* =========================================================
   <Start> OPEN ROOM
   ---------------------------------------------------------
   Membuka room berdasarkan room key.
   ========================================================= */

function openRoom(
  roomKey,
  pushHistory = true
) {

  const room =
    ROOMS[roomKey];


  if (!room) {

    console.warn(
      'Unknown room:',
      roomKey
    );

    return;

  }

   if (
    pushHistory
  ) {

    pushRoomHistory(
      roomKey
    );

  }



  const office =
    getElement('central-office');

  const roomView =
    getElement('room-view');


  const roomNumber =
    getElement('room-number');

  const roomTitle =
    getElement('room-title');

  const roomDescription =
    getElement('room-description');

  const roomStatus =
    getElement('room-status');


  if (
    !office ||
    !roomView
  ) {

    return;

  }


  // -----------------------------------------
  // Populate room
  // -----------------------------------------

  roomNumber.textContent =
    room.number;

  roomTitle.textContent =
    room.title;

  roomDescription.textContent =
    room.description;

  roomStatus.textContent =
    room.status;


  // -----------------------------------------
  // Switch view
  // -----------------------------------------

  office.classList.add(
    'is-hidden'
  );

  roomView.classList.remove(
    'is-hidden'
  );


  console.log(
    'Opened room:',
    roomKey
  );

}

/* =========================================================
   <Finish> OPEN ROOM
   ========================================================= */


/* =========================================================
   <Start> CLOSE ROOM
   ---------------------------------------------------------
   Kembali ke Central Office.

   Jika dipanggil oleh tombol internal, kita melakukan
   history.back().

   Jika dipanggil oleh browser BACK, parameter false
   mencegah history.back() dipanggil lagi.
   ========================================================= */

function closeRoom(
  goBack = true
) {

  if (
    goBack &&
    history.state &&
    history.state.narehate === true &&
    history.state.view === 'room'
  ) {

    history.back();

    return;

  }


  const office =
    getElement('central-office');

  const roomView =
    getElement('room-view');


  if (roomView) {

    roomView.classList.add(
      'is-hidden'
    );

  }


  if (office) {

    office.classList.remove(
      'is-hidden'
    );

  }


  APP.currentView =
    'office';

}

/* =========================================================
   <Finish> CLOSE ROOM
   ========================================================= */


/* =========================================================
   <Start> APPLICATION HISTORY
   ---------------------------------------------------------
   Browser history digunakan sebagai navigation stack
   internal aplikasi.

   Contoh:

       OFFICE
          ↓
       MAP ROOM
          ↓
       TELLER

   Browser BACK:

       TELLER
          ↓
       MAP ROOM
          ↓
       OFFICE

   Tidak ada page reload.
   ========================================================= */


/* =========================================================
   INITIALIZE HISTORY
   ========================================================= */

function initializeApplicationHistory() {

  if (
    APP.historyReady
  ) {

    return;

  }


  const currentState =
    history.state;


  if (
    !currentState ||
    currentState.narehate !== true
  ) {

    history.replaceState(
      {
        narehate: true,
        view: 'office'
      },
      '',
      window.location.href
    );

  }


  APP.historyReady =
    true;


  window.addEventListener(
    'popstate',
    handleBrowserBack
  );

}


/* =========================================================
   HANDLE BROWSER BACK
   ========================================================= */

function handleBrowserBack(event) {

  const state =
    event.state;


  // -----------------------------------------
  // State milik Narehate
  // -----------------------------------------

  if (
    state &&
    state.narehate === true
  ) {

    if (
      state.view === 'office'
    ) {

      closeRoom(
        false
      );

      return;

    }


    if (
      state.view === 'room' &&
      state.room
    ) {

      openRoom(
        state.room,
        false
      );

      return;

    }

  }


  // -----------------------------------------
  // Kalau state bukan milik aplikasi,
  // biarkan browser melakukan navigasi normal.
  // -----------------------------------------

}


/* =========================================================
   PUSH ROOM HISTORY
   ========================================================= */

function pushRoomHistory(roomKey) {

  history.pushState(
    {
      narehate: true,
      view: 'room',
      room: roomKey
    },
    '',
    window.location.href
  );

}


/* =========================================================
   <Finish> APPLICATION HISTORY
   ========================================================= */


/* =========================================================
   <Start> BIND ROOM EVENTS
   ---------------------------------------------------------
   Semua room card menggunakan data-room.

   Contoh:

       data-room="map"

   akan memanggil:

       openRoom('map')
   ========================================================= */

function bindRoomEvents() {

  const roomCards =
    document.querySelectorAll(
      '[data-room]'
    );


  roomCards.forEach(
    function(card) {

      card.addEventListener(
        'click',
        function() {

          const roomKey =
            card.dataset.room;

          openRoom(
            roomKey
          );

        }
      );

    }
  );


  const backButton =
    getElement(
      'back-to-office'
    );


  if (backButton) {

    backButton.addEventListener(
      'click',
      closeRoom
    );

  }

}

/* =========================================================
   <Finish> BIND ROOM EVENTS
   ========================================================= */


/* =========================================================
   <Start> EVENT BINDING
   ---------------------------------------------------------
   Menghubungkan seluruh interaction layer frontend.

   - Room navigation
   - Credential authentication
   ========================================================= */

function bindEvents() {

  bindRoomEvents();

  bindCredentialAuthenticationEvents();

}


/* =========================================================
   <Finish> EVENT BINDING
   ========================================================= */




/* =========================================================
   APPLICATION INITIALIZATION
   ---------------------------------------------------------
   Boot sequence:

       1. Public config
       2. Server status
       3. Native credential events
       4. Google Identity Services
       5. Correspondence Gate

   IMPORTANT:
   Google authentication TIDAK boleh memblokir
   Correspondence Gate.

   User harus tetap bisa memilih:

       Google
          atau
       Native Credential

   Google callback akan menjalankan authentication
   secara terpisah setelah user memilih account.
   ========================================================= */

/* <Start> BLOCK 53 — APPLICATION INITIALIZATION + REGISTRATION HANDOFF */

async function initializeApplication() {

  try {

    /* -----------------------------------------
       PUBLIC CONFIG
       ----------------------------------------- */

    setLoadingStatus(
      'Reading postal configuration...'
    );


    await loadPublicConfig();


    /* -----------------------------------------
       SERVER STATUS
       ----------------------------------------- */

    setLoadingStatus(
      'Contacting central office...'
    );


    await loadServerStatus();


    /* -----------------------------------------
       NATIVE CREDENTIAL EVENTS
       ----------------------------------------- */

    setLoadingStatus(
      'Preparing correspondent registry...'
    );


    bindCredentialAuthenticationEvents();


    /* -----------------------------------------
       GOOGLE IDENTITY SERVICES
       ----------------------------------------- */

    setLoadingStatus(
      'Preparing identity service...'
    );


    await initializeGoogleIdentity();


    /* -----------------------------------------
       CHECK REGISTRATION HANDOFF
       -----------------------------------------

       registration.html menyimpan handoff
       setelah account berhasil dibuat.

       Password TIDAK pernah disimpan.
       ----------------------------------------- */

    let registrationHandoff =
      null;


    try {

      const rawHandoff =
        sessionStorage.getItem(
          'NAREHATE_REGISTRATION_HANDOFF'
        );


      if (
        rawHandoff
      ) {

        registrationHandoff =
          JSON.parse(
            rawHandoff
          );

      }

    } catch (
      handoffError
    ) {

      console.warn(
        '[NAREHATE] Invalid registration handoff.',
        handoffError
      );

    }




     /* -----------------------------------------
   RESTORE EXISTING SESSION
   ----------------------------------------- */

setLoadingStatus(
  'Checking correspondent session...'
);


const sessionRestored =
  await restoreNarehateSession();


if (
  sessionRestored
) {

  await enterCentralOfficeAfterCredentialLogin();

  console.log(
    '[NAREHATE] Existing session restored. Central Office opened.'
  );

  return;

}

    /* -----------------------------------------
       VALID REGISTRATION HANDOFF
       ----------------------------------------- */

    if (
      registrationHandoff &&
      registrationHandoff.authenticated === true &&
      registrationHandoff.registered === true &&
      registrationHandoff.user
    ) {

      console.log(
        '[NAREHATE] Registration handoff detected.'
      );


      /* ---------------------------------------
         RESTORE IDENTITY
         --------------------------------------- */

      APP.identity = {

        success:
          true,

        authenticated:
          true,

        registered:
          true,

        needsRegistration:
          false,

        user:
          registrationHandoff.user

      };


      APP.user =
        registrationHandoff.user;


      /* ---------------------------------------
         HANDOFF SUDAH DIPAKAI
         --------------------------------------- */

      sessionStorage.removeItem(
        'NAREHATE_REGISTRATION_HANDOFF'
      );


      updateDebugPanel();


      /* ---------------------------------------
         OPEN CENTRAL OFFICE
         --------------------------------------- */

      await enterCentralOfficeAfterCredentialLogin();


      console.log(
        '[NAREHATE] Registration handoff completed.'
      );


      return;

    }


    /* -----------------------------------------
       NORMAL VISITOR FLOW
       ----------------------------------------- */

    showCorrespondenceGate();


    setLoadingStatus(
      'Correspondence Gate ready.'
    );


    console.log(
      '[NAREHATE] Application initialization complete.'
    );


  } catch (
    error
  ) {

    console.error(
      '[NAREHATE] APPLICATION INITIALIZATION ERROR:',
      error
    );


    setLoadingStatus(
      'The postal service could not be reached.'
    );

  }

}

/* <Finish> BLOCK 53 — APPLICATION INITIALIZATION + REGISTRATION HANDOFF */


/* =========================================================
   <Start> CORRESPONDENCE GATE NAVIGATION
   ---------------------------------------------------------
   Loading
      ↓
   Correspondence Gate
   ========================================================= */

function showCorrespondenceGate() {

  const loading =
    getElement(
      'loading-screen'
    );


  const gate =
    getElement(
      'correspondence-gate'
    );


  const mainApp =
    getElement(
      'main-app'
    );


  /*
   * Hide loading.
   */

  if (loading) {

    loading.classList.add(
      'is-hidden'
    );

  }


  /*
   * Hide main application shell.
   *
   * Central Office belum boleh terlihat.
   */

  if (mainApp) {

    mainApp.classList.add(
      'is-hidden'
    );

  }


  /*
   * Show Correspondence Gate.
   */

  if (gate) {

    gate.classList.remove(
      'is-hidden'
    );

  }


  APP.currentView =
    'correspondence-gate';


  console.log(
    '[NAREHATE] Correspondence Gate opened.'
  );

}


/* =========================================================
   <Finish> CORRESPONDENCE GATE NAVIGATION
   ========================================================= */





/* =========================================================
   <Start> APPLICATION BOOT
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  function() {

    initializeApplication();

  }
);

/* =========================================================
   <Finish> APPLICATION BOOT
   ========================================================= */


   /* =========================================================
   <Start> ENVIRONMENT HOTSPOT EVENTS
   ---------------------------------------------------------
   Global click handler untuk environment hotspots.

   Menggunakan CAPTURE PHASE supaya event tetap tertangkap
   walaupun ada layer / handler lain di dalam environment.

   Hotspot tetap invisible secara visual, tetapi seluruh
   area hotspot menjadi clickable.
   ========================================================= */

function bindEnvironmentHotspots() {

  /*
   * Hindari memasang listener dua kali.
   */

  if (
    window.__narehateEnvironmentHotspotsBound
  ) {

    return;

  }


  window.__narehateEnvironmentHotspotsBound =
    true;


  document.addEventListener(
    'click',
    function(event) {

      /*
       * Cari hotspot terdekat dari elemen yang diklik.
       *
       * Ini juga bekerja jika user mengklik:
       * - hotspot langsung
       * - indicator
       * - label
       */

      const hotspot =
        event.target.closest(
          '.environment-hotspot'
        );


      /*
       * Bukan hotspot.
       */

      if (!hotspot) {

        return;

      }


      /*
       * Ambil tujuan room.
       */

      const roomKey =
        hotspot.dataset.room;


      console.log(
        '[NAREHATE] Hotspot clicked:',
        roomKey
      );


      /*
       * Validasi.
       */

      if (!roomKey) {

        console.warn(
          '[NAREHATE] Hotspot has no room key.',
          hotspot
        );

        return;

      }


      /*
       * Hentikan event supaya tidak diteruskan
       * ke handler lain.
       */

      event.preventDefault();
      event.stopPropagation();


      /*
       * Buka room.
       */

      openRoom(
        roomKey
      );

    },
    true
  );


  console.log(
    '[NAREHATE] Environment hotspot system ONLINE.'
  );

}

/* =========================================================
   <Finish> ENVIRONMENT HOTSPOT EVENTS
   ========================================================= */





/* =========================================================
   CREDENTIAL LOGIN REQUEST
   ---------------------------------------------------------
   Frontend
      ↓
   Cloudflare /api
      ↓
   Apps Script
      ↓
   case 'credentiallogin'
      ↓
   loginWithCredentials()
   ========================================================= */

async function loginWithCredential(
  identifier,
  password
) {

  const result =
    await apiRequest(
      'credentiallogin',
      {
        identifier:
          identifier,

        password:
          password
      }
    );


  if (
    result &&
    result.success === true &&
    result.sessionToken
  ) {

    saveNarehateSession(
      result.sessionToken,
      result.expiresAt
    );

  }


  console.log(
    '[NAREHATE] Credential login response:',
    {
      success:
        result &&
        result.success === true,

      authenticated:
        result &&
        result.authenticated === true,

      registered:
        result &&
        result.registered === true,

      hasSession:
        !!(
          result &&
          result.sessionToken
        )
    }
  );


  return result;

}



/* =========================================================
   <Start> CREDENTIAL REGISTRATION REDIRECT
   ---------------------------------------------------------
   Jika credential belum ditemukan, user diarahkan
   ke halaman registration.

   Password TIDAK pernah dimasukkan ke URL.
   ========================================================= */

/* <Start> BLOCK 54 — GATE TO REGISTRATION TRANSITION */

function openCredentialRegistration(
  identifier
) {

  const query =
    identifier
      ? (
          '?identifier=' +
          encodeURIComponent(
            identifier
          )
        )
      : '';


  /* -----------------------------------------
     CREATE BLACKOUT OVERLAY
     ----------------------------------------- */

  let transition =
    document.getElementById(
      'narehate-page-transition'
    );


  if (
    !transition
  ) {

    transition =
      document.createElement(
        'div'
      );

    transition.id =
      'narehate-page-transition';


    transition.style.position =
      'fixed';

    transition.style.inset =
      '0';

    transition.style.background =
      '#000000';

    transition.style.opacity =
      '0';

    transition.style.pointerEvents =
      'none';

    transition.style.zIndex =
      '999999';

    transition.style.transition =
      'opacity 850ms cubic-bezier(0.65, 0, 0.35, 1)';


    document.body.appendChild(
      transition
    );

  }


  /* -----------------------------------------
     START BLACKOUT
     ----------------------------------------- */

  requestAnimationFrame(
    function() {

      transition.style.opacity =
        '1';

    }
  );


  /* -----------------------------------------
     WAIT UNTIL FULL BLACK
     ----------------------------------------- */

  setTimeout(
    function() {

      window.location.href =
        '/registration.html' +
        query;

    },
    900
  );

}

/* <Finish> BLOCK 54 — GATE TO REGISTRATION TRANSITION */


/* <Start> BLOCK 52 — ENTER CENTRAL OFFICE AFTER AUTHENTICATION */

async function enterCentralOfficeAfterCredentialLogin() {

  setLoadingStatus(
    'Opening Central Office...'
  );


  /* -----------------------------------------
     PREPARE APPLICATION
     ----------------------------------------- */

  await prepareApplication();


  /* -----------------------------------------
     GET ENVIRONMENTS
     ----------------------------------------- */

  const loading =
    getElement(
      'loading-screen'
    );

  const mainApp =
    getElement(
      'main-app'
    );

  const gate =
    getElement(
      'correspondence-gate'
    );

  const door =
    getElement(
      'door-environment'
    );

  const registration =
    getElement(
      'registration-environment'
    );

  const office =
    getElement(
      'environment-view'
    );


  /* -----------------------------------------
     HIDE LOADING
     ----------------------------------------- */

  if (
    loading
  ) {

    loading.classList.add(
      'is-hidden'
    );

  }


  /* -----------------------------------------
     SHOW MAIN APPLICATION
     ----------------------------------------- */

  if (
    mainApp
  ) {

    mainApp.classList.remove(
      'is-hidden'
    );

  }


  /* -----------------------------------------
     HIDE CORRESPONDENCE GATE
     ----------------------------------------- */

  if (
    gate
  ) {

    gate.classList.add(
      'is-hidden'
    );

  }


  /* -----------------------------------------
     HIDE DOOR
     ----------------------------------------- */

  if (
    door
  ) {

    door.classList.add(
      'is-hidden'
    );

  }


  /* -----------------------------------------
     HIDE REGISTRATION
     ----------------------------------------- */

  if (
    registration
  ) {

    registration.classList.add(
      'is-hidden'
    );

  }


  /* -----------------------------------------
     SHOW CENTRAL OFFICE
     ----------------------------------------- */

  if (
    office
  ) {

    office.classList.remove(
      'is-hidden'
    );

  }


  APP.currentView =
    'office';


  initializeApplicationHistory();


  console.log(
    '[NAREHATE] Credential correspondent entered Central Office.'
  );

}

/* <Finish> BLOCK 52 — ENTER CENTRAL OFFICE AFTER AUTHENTICATION */


/* =========================================================
   <Finish> CREDENTIAL AUTHENTICATION
   ========================================================= */



/* =========================================================
   <Start> CREDENTIAL AUTHENTICATION EVENTS
   ---------------------------------------------------------
   Menghubungkan Correspondence Gate dengan native
   Narehate credential authentication.

   Flow:

   USER
     ↓
   identifier + password
     ↓
   credentialLogin
     ↓
   ┌─────────────────────────────┐
   │ Account ditemukan?          │
   └─────────────────────────────┘
       │
       ├─ YES
       │   ↓
       │ authenticate
       │   ↓
       │ Central Office
       │
       └─ NO
           ↓
       Registration
   ========================================================= */

function bindCredentialAuthenticationEvents() {

  const identifierInput =
    getElement(
      'gate-identifier'
    );

  const passwordInput =
    getElement(
      'gate-password'
    );

  const loginButton =
    getElement(
      'gate-login-register'
    );

  const status =
    getElement(
      'gate-credential-status'
    );


  /* -----------------------------------------
     Pastikan element tersedia
     ----------------------------------------- */

  if (
    !identifierInput ||
    !passwordInput ||
    !loginButton
  ) {

    console.warn(
      '[NAREHATE] Credential authentication elements not found.'
    );

    return;

  }


  /* -----------------------------------------
     Hindari binding dua kali
     ----------------------------------------- */

  if (
    loginButton.dataset.credentialBound ===
    'true'
  ) {

    return;

  }


  loginButton.dataset.credentialBound =
    'true';


  /* -----------------------------------------
     STATUS HELPER
     ----------------------------------------- */

  function setCredentialStatus(
    message,
    isError
  ) {

    if (!status) {

      return;

    }


    status.textContent =
      message;


    status.classList.toggle(
      'is-error',
      !!isError
    );

  }


  /* -----------------------------------------
     LOGIN / REGISTER
     ----------------------------------------- */

  loginButton.addEventListener(
    'click',
    async function() {

      const identifier =
        identifierInput.value
          .trim();

      const password =
        passwordInput.value;


      /* -------------------------------------
         Validasi identifier
         ------------------------------------- */

      if (!identifier) {

        setCredentialStatus(
          'Enter your username, email, or phone.',
          true
        );

        identifierInput.focus();

        return;

      }


      /* -------------------------------------
         Validasi password
         ------------------------------------- */

      if (!password) {

        setCredentialStatus(
          'Enter your password.',
          true
        );

        passwordInput.focus();

        return;

      }


      /* -------------------------------------
         Loading state
         ------------------------------------- */

      loginButton.disabled =
        true;

      loginButton.textContent =
        'CHECKING...';


      setCredentialStatus(
        'Checking correspondent registry...',
        false
      );


      try {

        const result =
          await loginWithCredential(
            identifier,
            password
          );


        /* ===================================
           ACCOUNT BELUM TERDAFTAR
           =================================== */

        if (
          result &&
          result.needsRegistration === true
        ) {

          setCredentialStatus(
            'Correspondent not found. Opening registration...',
            false
          );


          openCredentialRegistration(
            identifier
          );


          return;

        }


        /* ===================================
           LOGIN BERHASIL
           =================================== */

        if (
          result &&
          result.success === true &&
          result.authenticated === true &&
          result.registered === true &&
          result.user
        ) {

          APP.identity =
            result;

          APP.user =
            result.user;


          updateDebugPanel();


          setCredentialStatus(
            'Correspondence established.',
            false
          );


          await enterCentralOfficeAfterCredentialLogin();


          return;

        }


        /* ===================================
           RESPONSE TIDAK VALID
           =================================== */

        throw new Error(
          result &&
          result.error
            ? result.error
            : 'Authentication failed.'
        );

      }

      catch (
        error
      ) {

        console.error(
          '[NAREHATE] CREDENTIAL AUTHENTICATION ERROR:',
          error
        );


        setCredentialStatus(
          error.message ||
            'Authentication failed.',
          true
        );

      }

      finally {

        loginButton.disabled =
          false;

        loginButton.textContent =
          'LOGIN / REGISTER';

      }

    }
  );


  /* -----------------------------------------
     ENTER KEY
     ----------------------------------------- */

  function handleCredentialEnter(
    event
  ) {

    if (
      event.key ===
      'Enter'
    ) {

      event.preventDefault();

      loginButton.click();

    }

  }


  identifierInput.addEventListener(
    'keydown',
    handleCredentialEnter
  );


  passwordInput.addEventListener(
    'keydown',
    handleCredentialEnter
  );


  console.log(
    '[NAREHATE] Credential authentication events ONLINE.'
  );

}


/* =========================================================
   <Finish> CREDENTIAL AUTHENTICATION EVENTS
   ========================================================= */

