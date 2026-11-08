/**
 * Bloom backend — Google Apps Script web app over a Google Sheet.
 *
 * Tabs: recipes, brews, days, settings (created automatically on first use).
 * Columns: id | updatedAt | deleted | title | date | overall | json
 *
 * Setup: Project Settings → Script Properties → add API_TOKEN.
 * Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 */

var ENTITIES = ['recipes', 'brews', 'days', 'settings'];
var HEADERS = ['id', 'updatedAt', 'deleted', 'title', 'date', 'overall', 'json'];
var COL = { id: 1, updatedAt: 2, deleted: 3, title: 4, date: 5, overall: 6, json: 7 };

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected) throw new Error('API_TOKEN script property is not set');
  if (!token || String(token) !== String(expected)) throw new Error('Unauthorized');
}

function sheet_(name) {
  if (ENTITIES.indexOf(name) < 0) throw new Error('Unknown entity: ' + name);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(COL.json, 400);
    sh.getRange('A:B').setNumberFormat('@'); // keep id/updatedAt as plain text
  }
  return sh;
}

/** Human-scannable columns. */
function readable_(entity, d) {
  var title = '', date = '', overall = '';
  if (entity === 'recipes') {
    title = (d.name || '') + (d.version ? ' (v' + d.version + ')' : '');
    date = d.createdAt ? String(d.createdAt).slice(0, 10) : '';
  } else if (entity === 'brews') {
    title = d.title || '';
    date = d.dateTime ? Utilities.formatDate(new Date(d.dateTime), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm') : '';
    overall = d.sensory && d.sensory.overall != null ? d.sensory.overall : '';
  } else if (entity === 'days') {
    title = d.endOfDayConclusion ? String(d.endOfDayConclusion).slice(0, 80) : '';
    date = d.date || '';
  } else if (entity === 'settings') {
    title = d.title || '';
    date = d.eventDateTime || '';
  }
  return [title, date, overall];
}

function readAll_(entity) {
  var sh = sheet_(entity);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var raw = values[i][COL.json - 1];
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch (err) {
      // skip malformed rows
    }
  }
  return out;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    checkToken_(p.token);
    var action = p.action || 'list';
    if (action !== 'list') throw new Error('Unknown action: ' + action);
    var data = {};
    ENTITIES.forEach(function (name) {
      data[name] = readAll_(name);
    });
    return json_({ ok: true, data: data, serverTime: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Body arrives as text/plain to avoid a CORS preflight; parse JSON ourselves.
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkToken_(body.token);

    var action = body.action;
    var entity = body.entity;
    var data = body.data;
    if (action !== 'upsert' && action !== 'delete') throw new Error('Unknown action: ' + action);
    if (!data || !data.id) throw new Error('Missing data.id');

    lock.waitLock(20000);

    var sh = sheet_(entity);
    var last = sh.getLastRow();
    var rowIndex = -1;
    var existingUpdatedAt = '';
    if (last >= 2) {
      var ids = sh.getRange(2, COL.id, last - 1, 2).getValues(); // id, updatedAt
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(data.id)) {
          rowIndex = i + 2;
          existingUpdatedAt = ids[i][1] instanceof Date ? ids[i][1].toISOString() : String(ids[i][1] || '');
          break;
        }
      }
    }

    var incomingUpdatedAt = String(data.updatedAt || new Date().toISOString());

    // Last write wins: ignore stale writes.
    if (rowIndex > 0 && existingUpdatedAt && incomingUpdatedAt < existingUpdatedAt) {
      return json_({ ok: true, ignored: 'stale', id: data.id });
    }

    if (action === 'delete') data.deleted = true;
    data.updatedAt = incomingUpdatedAt;

    var r = readable_(entity, data);
    var row = [String(data.id), incomingUpdatedAt, data.deleted ? true : false, r[0], r[1], r[2], JSON.stringify(data)];

    if (rowIndex > 0) {
      sh.getRange(rowIndex, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    // Keep updatedAt as plain text so comparisons stay lexicographic ISO.
    return json_({ ok: true, id: data.id, updatedAt: incomingUpdatedAt });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignore) {}
  }
}

/** Run once from the editor to create the tabs and format the updatedAt column as text. */
function setup() {
  ENTITIES.forEach(function (name) {
    var sh = sheet_(name);
    sh.getRange('B:B').setNumberFormat('@');
  });
}
