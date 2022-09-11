// ==UserScript==
// @name         TemTem MapGenie Tweaks
// @namespace    https://github.com/Silverfeelin/
// @version      0.1
// @description  Adds some info to the TemTem MapGenie site.
// @author       Silverfeelin
// @license      MIT
// @match        https://mapgenie.io/temtem/maps/*
// @grant        GM.xmlHttpRequest
// @grant        GM.addStyle
// @grant        GM.setValue
// @grant        GM.getValue
// ==/UserScript==

const pollInterval = 200;
const markerImage = 'https://i.imgur.com/D9vSeka.png';
const typeTables = {};
const typeImages = [
  '1tKqW05', 'Oz6hbLD', 'CHetaWi',
  '27rFFjB', 'EUqkYeA', '4tkKMzG',
  '9jJOKYg', 'dgAKCYS', '35aZSQ8',
  'UklP6t2', 'x7GKRcP', 'wpv3hl5',
].map(i => `https://i.imgur.com/${i}.webp`);

// locationId: { id*, completed*, pos*, marker };
let trackedMarkers = {};

(async () => {
  GM.addStyle(`
    .stt-marker-types img { width: 20px; }

    .stt-marker-types th, .stt-marker-types td {
      color: #000;
      font-size: 14px;
      
      border: 1px solid #82549d;
      text-align: center;
    }

    .stt-marker-types td {
      padding: 2px;
    }

    .stt-marker-types .eq { background: #ffff6e !important; }
    .stt-marker-types .pos { background: #55ff6e !important; }
    .stt-marker-types .neg { background: #ff6e6e !important; }

    .marker-buttons { border-top: 1px solid rgba(253,243,207,0.2); }

    .marker-buttons div { display: inline-block !important; }
    .marker-buttons .marker-button-fancy { border: none !important; }

    .stt-found { margin-left: 20px; }
    .stt-green { background: #114c11 !important; }

    .stt-marker { padding-bottom: 44px; }
  `);

  // Load data from greasy storage.
  // await clearStoredData();
  await loadStoredData();
  initializeMarkers();

  // Poll visible marker to inject info.
  setInterval(() => {
    const marker = document.querySelector('#marker-info:not(.stt)');
    if (!marker) return;
    marker.classList.add('stt');

    // Add contextual information.
    const category = marker.querySelector('.category')?.innerText?.trim();
    switch (category) {
      case 'Tamer': populateTamer(marker); break;
    }

    removeThatAnnoyingProReminder(marker);
    hijackThatFoundCheckbox(marker);
  }, pollInterval);
})();

// #region Storage

async function loadStoredData() {
  const storageData = JSON.parse(await GM.getValue('stt', '{}'));
  console.log('STT', storageData);

  // Initialize data
  (storageData.markers || []).forEach(m => {
    trackedMarkers[m.id] = { id: m.id , completed: m.completed, pos: m.pos };
  });
}

async function storeLoadedData() {
  const data = {
    markers: Object.keys(trackedMarkers).map(id => {
      const m = trackedMarkers[id];
      return { id: m.id, completed: m.completed, pos: m.pos };
    })
  };
  await GM.setValue('stt', JSON.stringify(data));
}

async function clearStoredData() {
  await GM.setValue('stt', '{}');
}

// #endregion

function removeThatAnnoyingProReminder(marker) {
  marker.querySelector('.free-user-locations-info')?.remove();
}

function hijackThatFoundCheckbox(marker) {
  const buttons = marker.querySelector('.marker-buttons');
  if (buttons) {
    // Find location the hacky way because I don't know React :) 
    const markerProps = marker[Object.keys(marker).filter(k => k.startsWith('__reactProps'))[0] || ''];
    const location = markerProps?.children?.filter(f => f?.type === 'h3')[0]?._owner?.memoizedProps?.location;
    if (!location) { throw new Error("Oops. Couldn't find location ID."); }
    const locationId = location.id;

    // Create entry if untracked.
    trackedMarkers[locationId] ??= {
      id: locationId, completed: false, pos: [location.longitude, location.latitude]
    };
    
    // Create found checkbox
    const container = document.createElement('div');
    const input = document.createElement('input');
    const label = document.createElement('label');
    container.appendChild(input);
    container.appendChild(label);
    buttons.appendChild(container);

    container.setAttribute('class', 'stt-found custom-control custom-checkbox marker-button-fancy');
    label.setAttribute('class', 'custom-control-label');
    label.setAttribute('for', 'stt-found');
    label.style.pointerEvents = 'all';
    label.innerText = '"Found"';
    input.setAttribute('id', 'stt-found');
    input.checked = trackedMarkers[locationId]?.completed || false;
    input.setAttribute('type', 'checkbox');
    input.setAttribute('class', 'custom-control-input');

    // Add marker
    if (!trackedMarkers[locationId].marker) {
      addMapMarker(trackedMarkers[locationId]);
    }

    // Set checked
    const updateVisuals = () => {
      buttons.classList.toggle('stt-green', input.checked);
      trackedMarkers[locationId].marker._element.style.display = input.checked ? 'block' : 'none';
    };
    updateVisuals();

    input.addEventListener('change', evt => {
      updateVisuals();
      setLocationCompleted(locationId, input.checked);
      storeLoadedData(); // fire n forget
    });
  }
}

function initializeMarkers() {
  Object.keys(trackedMarkers).forEach(id => {
    const m = trackedMarkers[id];
    if (m.marker || !m.pos) return;
    addMapMarker(m);
  });
}

function addMapMarker(marker) {
  const div = document.createElement('div');
  div.insertAdjacentHTML('beforeend', `<img src="${markerImage}">`);
  div.className = 'stt-marker';
  div.style.pointerEvents = 'none';
  
  const mapMarker = new mapboxgl.Marker(div);
  mapMarker.setLngLat(marker.pos).addTo(map);
  trackedMarkers[marker.id].marker = mapMarker;
  div.style.display = marker.completed ? 'block' : 'none';
}

function setLocationCompleted(locationId, completed) {
  trackedMarkers[locationId].completed = completed;
}

function populateTamer(marker) {
  marker.querySelectorAll('.marker-content .description ul li').forEach(li => {
    // Find Temtem name
    const temtem = li.innerText.match(/[a-zA-Z0-9]*/g)?.[0];
    if (!temtem) return;

    // Add wiki link
    const url = `https://temtem.fandom.com/wiki/${temtem}`;
    li.innerHTML = `<a href="${url}" target="_blank">${li.innerHTML}</a>`;

    // Add matchup type data
    fetchTypes(temtem, li);
  });
}

// #region Types

function fetchTypes(temtem, li) {
  // Use stored data.
  if (typeTables[temtem]) {
    appendTypeTable(temtem, li);
    return;
  }

  // Fetch matchup data from wiki.
  const url = `https://temtem.fandom.com/wiki/${temtem}`;
  // eslint-disable-next-line no-undef
  GM.xmlHttpRequest({
    method: 'GET', url,
    onload: function (response) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(response.responseText, 'text/html');
      const types = doc.querySelector('#content .type-table');
      let values = [...types.querySelectorAll('tr:nth-child(2) td')].map(td => td.innerText?.trim() || '-');

      // TODO: Support traits. For now just skip trait column.
      values = values.slice(-12);

      createTypeTable(temtem, values);
      appendTypeTable(temtem, li);
    }
  });
}

/** Create matchup table for Temtem using wiki data. */
function createTypeTable(temtem, values) {
  const tbl = document.createElement('table')
  tbl.classList.add('stt-marker-types');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const body = document.createElement('tbody');
  const bodyRow = document.createElement('tr');

  typeImages.forEach((img, i) => {
    const val = values[i].split('/');
    const bgClass = val[0] === '-' ? 'eq' : !val[1] || +val[0] > +val[1] ? 'pos' : 'neg';
    headRow.insertAdjacentHTML('beforeend', `<th><img src="${img}"></img></th>`)
    bodyRow.insertAdjacentHTML('beforeend', `<td class="${bgClass}">${values[i]}</td>`)
  });

  tbl.appendChild(head);
  head.appendChild(headRow);
  tbl.appendChild(body);
  body.appendChild(bodyRow);

  typeTables[temtem] = tbl;
}

/** Append matchup table for Temtem to element. */
function appendTypeTable(temtem, el) {
  const tbl = typeTables[temtem];
  if (!tbl) return;

  el.insertAdjacentHTML('beforeend', '<br/>');
  el.appendChild(tbl);
}

// #endregion