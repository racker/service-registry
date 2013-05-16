#!/usr/bin/env node
/**
 *  Copyright 2013 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var sys = require('util');
var fs = require('fs');
var path = require('path');

var swiz = require('swiz');
var help = swiz.help;
var sprintf = require('sprintf').sprintf;

var dbu = require('../lib/public_api/defs');

var existsSync = fs.existsSync ? fs.existsSync : path.existsSync;


/**
 * For which target the fixtures are generated.
 * @type {String}
 * @const
 */
var GENERATE_FOR = 'public';


/**
 * The tags that have a string value in the help that can be dropped.
 * @type {Array}
 * @const
 */
var STRING_TAGS = ['regex', 'len'];

/** This is a bit of an ugly hack, but neither Tomaz nor I (ken) could figure
 * out how to generalize it.  It's OK.  I'm sure it'll just get JIT-ed out. :)
 */
function hasDuplicatedStringValves(chain) {
  return chain.some(function (element, index, array) {
    return STRING_TAGS.indexOf(element.name) !== -1;
  });
}

/** Generate a single row of the table for a given field in a message */
function generateLine(name, desc, chain) {
  desc = desc || '';
  var schema, v, str = '', i, l, validation, filterStr, hasName = false;

  str += sprintf('%s | %s | ', name, desc);

  if (chain !== undefined) {
    schema = { 'a' : chain };
    v = new swiz.Valve( schema );
    validation = v.help().a;
    filterStr = hasDuplicatedStringValves(v.schema.a.validators);

    l = validation.length;

    for (i = 0; i<l; i++) {
      if (validation[i] === 'Optional' && name === 'id' && l > 1) {
        // Hack: Swiz sets every attribute with 'src' attribute as optional
        continue;
      }

      if (!(validation[i] === 'String' && filterStr)) {
        str += validation[i];

        if (i !== (l - 1)) {
          str += ', ';
        }
      }
    }
  }

  str += '\n';

  return str;
}

function fieldSort(a, b) {
  return a.name > b.name;
}

function sortDefFields(def) {
  var fields = def.fields, optionalFields = [], requiredFields = [];

  fields.forEach(function(field) {
    var validations;

    if (field.ignorePublic) {
      return;
    }
    if (field.filterFrom.length > 0 && field.filterFrom.indexOf(GENERATE_FOR) !== -1) {
      return;
    }

    validations = dbu.validity[def.name][field.name];

    if (validations.isOptional) {
      optionalFields.push(field);
    }
    else {
      requiredFields.push(field);
    }
  });

  requiredFields.sort(fieldSort);
  optionalFields.sort(fieldSort);

  return [].concat(requiredFields, optionalFields);
}

function groupFields(def) {
  var groups = {};
  var fields = def.fields;
  fields.forEach(function(field) {
    var group = 'main';
    if (field.ignorePublic) {
      return;
    }
    if(field.hasOwnProperty('group')) {
      group = field.group;
    }
    if (!groups.hasOwnProperty(group)) {
      groups[group] = {fields: [], name: def.name};
    }
    groups[field.group].fields.push(field);
  });
  Object.keys(groups).forEach(function(group) {
    groups[group] = sortDefFields(groups[group]);
  });
  return groups;
}

function sortCtFields(def) {
  var fields = def.fields, optionalFields = [], requiredFields = [];

  fields.forEach(function(field) {
    var validations;

    if (field.ignorePublic) {
      return;
    }
    if (field.filterFrom.length > 0 && field.filterFrom.indexOf(GENERATE_FOR) !== -1) {
      return;
    }
    validations = field.val;

    if (validations.isOptional) {
      optionalFields.push(field);
    }
    else {
      requiredFields.push(field);
    }
  });

  requiredFields.sort(fieldSort);
  optionalFields.sort(fieldSort);

  return [].concat(requiredFields, optionalFields);
}


function generateDefFragment(def, title, filename) {
  var fields = def.fields, sortedFields, len, i, field, str, validations, groupedFields;

  title = title[0].toUpperCase() + title.substring(1);
  str = 'Name | Description | Validation\n';
  str = str + '---- | --- | -----------\n';

  if (def.groups) {
    groupedFields = groupFields(def);
    Object.keys(groupedFields).forEach(function(group) {
      str = str + '<tr><td colspan="3"><emphasis>' + def.groups[group] + '</emphasis></td></tr>\n';
      sortedFields = groupedFields[group];
      sortedFields.forEach(function(field) {
        validations = dbu.validity[def.name][field.name];
        str = str + generateLine(field.name, field.desc, validations);
      });
    });
  } else {
    sortedFields = sortDefFields(def);
    sortedFields.forEach(function(field) {
      validations = dbu.validity[def.name][field.name];
      str = str + generateLine(field.name, field.desc, validations);
    });
  }

  fs.writeFileSync(filename, str);
}

function writeNoDetails(title, filename) {
  var str;
  str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-' + title + '">\n' +
        '<title>No Attributes</title>\n' +
        '<para>There are no particular attributes about this element</para>' +
        '</section>';
  fs.writeFileSync(filename, str);
}

function processDefs() {
  var prefix = path.join(__dirname + '/../fixtures/swiz'), i, len, def, fields, field, nonAgentChecks;

  if (!existsSync(prefix)) {
    fs.mkdirSync(prefix, 777);
  }

  for (i = 0, len = dbu.defs.length; i < len; i++) {
    def = dbu.defs[i];
    generateDefFragment(def, def.name, path.join(prefix, def.name + '.md'));
  }
}

processDefs();
