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
  .usage('Usage: $0 -i <path to directory containing md files> -o <output directory>')
  .alias('i', 'input')
  .alias('o', 'output')
  .demand(['i', 'o'])
  .argv;

var INCLUDE_REGEX = /\[include="(.*?)", type="(.*?)"\]/g;

function processFile(inputPath, outputPath, callback) {
  var content = fs.readFileSync(inputPath, 'utf8');

  function replaceFunction(str, file, type) {
    var filePath, fixtureContent, result, root, elem, xml, etree;

    filePath = path.join(__dirname, '../', file);
    fixtureContent = fs.readFileSync(filePath, 'utf8');

    if (type === 'swiz') {
      // Those get replaced later on in the pipeline
      result = fixtureContent;
    }
    else if (type === 'raw') {
      result = '```\n' + fixtureContent + '\n```';
    }
    else {
      result = '```' + type + '\n' + fixtureContent + '\n```';
    }

    return result;
  }

  content = content.replace(INCLUDE_REGEX, replaceFunction);
  fs.writeFileSync(outputPath, content, 'utf8');
  callback();
}

function replacePlacefolders(inputDirectory, outputDirectory) {
  var files = fs.readdirSync(inputDirectory);

  files = files.filter(function(name) {
    return (/\.md$/).test(name);
  });

  async.forEach(files, function(name, callback) {
    var inputFilePath = path.join(inputDirectory, name),
        outputFilePath = path.join(outputDirectory, name);

    processFile(inputFilePath, outputFilePath, callback);
  },

  function() {});
}

replacePlacefolders(argv.i, argv.o);
