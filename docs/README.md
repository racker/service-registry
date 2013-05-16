# Documentation

This directory contains generated and source files for the Service Registry
documentation.

## Directory Layout

* `docs/source/` - Source Markdown file with annotations for including fixtures
  and other files. Those are the only files which should be edited by a person
  writing the documentation.

* `docs/docbook/` - Docbook file templates and glue files.

* `docs/markdown/` - Valid Github flavored Markdown files which are generated
  from the source files.

* `docs/generated/` - Valid docbook files which are generated from the Github
  flavored Markdown files.

## Documentation Generation Pipeline

`markdown with annotation` -> `github flavored markdown` -> `docbook` -> `html / pdf`

## Generating the Documentation

`scripts/generate-docs.sh`

For this command to work you need to have Java and Maven installed.
