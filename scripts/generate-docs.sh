#!/bin/bash
#
# Copyright 2013 Rackspace
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

rm -rf docs/generated/
rm -rf docs/markdown/
rm -rf docs/src/docbkx
rm -rf fixtures/

mkdir docs/markdown/
mkdir docs/generated
mkdir -p docs/src/docbkx/img
mkdir -p fixtures/{request,response,swiz,misc}

# Copy images
cp docs/source/images/* docs/src/docbkx/img

# Generate request and response fixtures
scripts/generate-request-response-fixtures.sh fixtures

# Generate swiz fixtures
scripts/generate-swiz-fixtures.js

# Generate fault fixtures

scripts/generate-faults-fixture.js

# Generate limits fixtures

scripts/generate-resource-limits-table.js

# Replace placeholder in Markdown source files
scripts/replace-placeholders-in-markdown-files.js -i docs/source -o docs/markdown

# Generate Docbook from Markdown files
node_modules/.bin/markdown-to-docbook -i docs/markdown -o docs/generated/

# Postprocess the generated docbook file
scripts/postprocess-generated-docbook.js -i docs/generated -o docs/generated

# Copy existing and generated docbook files
cp docs/docbook/*.xml docs/src/docbkx
cp docs/generated/*.xml docs/src/docbkx
cp docs/pom.xml docs/src/docbkx
cp docs/includewars.xml docs/src/docbkx

cd docs/src/docbkx

# Generate HTML and PDF
mvn -f pom.xml -X clean generate-sources
