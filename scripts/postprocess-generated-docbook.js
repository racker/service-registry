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

var fs = require('fs');
var path = require('path');

var et = require('elementtree');
var XML = et.XML;
var ElementTree = et.ElementTree;
var element = et.Element;
var subElement = et.SubElement;
var async = require('async');
var argv = require('optimist')
  .usage('Usage: $0 -i <path to directory containing docbook files> -o <output directory>')
  .alias('i', 'input')
  .alias('o', 'output')
  .demand(['i', 'o'])
  .argv;

var DONT_CHUNK_SECTIONS = [
  'getting-started-getting-started-with-rackspace-service-registry',
  'general-api-information-faults',
  'concepts-',
  'service-api-operations-',
  'overview-what-is-rackspace-service-registry',
  'client-libraries-and-tools-client-libraries',
  'release-notes-',
  'other-contributing-to-the-documentation',
  'integration-instructions-general-flow',
];

var REGEX = /<section xml:id="(service-api-operations-\w+|client-libraries-and-tools-client-libraries|general-api-information-faults|concepts-\w+|overview-how-it-works|release-notes-v1.0.*?|other-contributing-to-the-documentation|integration-guide-general-flow|getting-started-getting-started-with-the-rackspace-service-registry)">/g;
var NOTE_REGEX = /__([^\0]+?)__(?!_)/;

function processFile(inputPath, outputPath, callback) {
  var content = fs.readFileSync(inputPath, 'utf8');

  function replaceFunction(str) {
    return '<?dbhtml stop-chunking?>\n' + str;
  }

  function noteReplaceFunction(str, value) {
    return '<note><para>' + value + '</para></note>';
  }

  DONT_CHUNK_SECTIONS.forEach(function(value) {
    var regex = new RegExp('<section xml:id="' + value + '.*?">', 'g');
    content = content.replace(regex, replaceFunction);
  });

  fs.writeFileSync(outputPath, content, 'utf8');
  callback();
}

function replacePlacefolders(inputDirectory, outputDirectory) {
  var files = fs.readdirSync(inputDirectory);

  files = files.filter(function(name) {
    return (/\.xml$/).test(name);
  });

  async.forEach(files, function(name, callback) {
    var inputFilePath = path.join(inputDirectory, name),
        outputFilePath = path.join(outputDirectory, name);

    processFile(inputFilePath, outputFilePath, callback);
  },

  function() {});
}

replacePlacefolders(argv.i, argv.o);
