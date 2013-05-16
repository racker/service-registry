# Service Registry (Farscape)

Service Registry (codename Farscape) is an API-driven cloud service built for
keeping track of your services. It also stores configuration values which
allows you to react to changes faster and make your application / service more
highly-available.

For more info, please see the
[wiki](https://github.com/racker/service-registry/wiki).

## Directory Structure

* `lib/` - Main service code.
* `tests/` - Unit, client and integration tests.
* `migrations/` - Database migration files. Those files should be generated
using `bin/migrations` tool and not edited directly.
* `scripts/` - Utility scripts.
* `static/` - Static files which are served over the HTTP server.
* `node_modules/` - Bundled Node.js modules.
* `bin/` - Service and tool entry points.
* `docs/` - Documentation files.
* `manual_fixtures/` - Manual request and response fixtures which are used in
the documentation.

## License

Service Registry is distributed under the [Apache 2.0 license](http://www.apache.org/licenses/LICENSE-2.0.html).
