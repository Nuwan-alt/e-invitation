/**
 * Dilshi & Nuwan — Wedding RSVP backend.
 * Deployed as a Google Apps Script web app; appends each RSVP submission
 * as a row in a sheet named "RSVP" (created automatically if missing).
 *
 * Setup: see the "RSVP setup" section in README.md.
 */

var SHEET_NAME = "RSVP";
var HEADERS = ["Timestamp", "Name", "Attending", "Guests", "Phone", "Message", "Guest Link"];
var MAX_LENGTHS = {
  name: 120,
  attending: 20,
  guests: 10,
  phone: 40,
  message: 400,
  guestParam: 120
};

function doGet() {
  return ContentService
    .createTextOutput("RSVP endpoint is running")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (lockErr) {
    return jsonResponse({ result: "error", message: "Server busy, please try again." });
  }

  try {
    var params = (e && e.parameter) || {};

    var name = trimAndLimit_(params.name, MAX_LENGTHS.name);
    if (!name) {
      return jsonResponse({ result: "error", message: "Name is required." });
    }

    var row = [
      new Date(),
      name,
      trimAndLimit_(params.attending, MAX_LENGTHS.attending),
      trimAndLimit_(params.guests, MAX_LENGTHS.guests),
      trimAndLimit_(params.phone, MAX_LENGTHS.phone),
      trimAndLimit_(params.message, MAX_LENGTHS.message),
      trimAndLimit_(params.guestParam, MAX_LENGTHS.guestParam)
    ];

    var sheet = getOrCreateSheet_();
    sheet.appendRow(row);

    return jsonResponse({ result: "success" });
  } catch (err) {
    return jsonResponse({ result: "error", message: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

function trimAndLimit_(value, maxLength) {
  var str = (value === undefined || value === null) ? "" : String(value).trim();
  if (str.length > maxLength) {
    str = str.substring(0, maxLength);
  }
  return str;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
