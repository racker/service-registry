CQL_REPLACEMENT ?= s/@@REPLICATION_FACTOR@@/$(REPLICATION_FACTOR)/g

FARSCAPE_SETUP_FILES = $(shell ls setup/farscape_*.cql | sort -V)
RPROXY_SETUP_FILES = $(shell ls setup/rproxy_*.cql | sort -V)

farscape-combined.cql:
	echo "-- *** Generated Schema ***" > farscape-combined.cql
	for f in $(FARSCAPE_SETUP_FILES); do \
	  sed -e "$(CQL_REPLACEMENT)" $$f >> farscape-combined.cql; \
	done \

rproxy-combined.cql:
	echo "-- *** Generated Schema ***" > rproxy-combined.cql
	for f in $(RPROXY_SETUP_FILES); do \
	  sed -e "$(CQL_REPLACEMENT)" $$f >> rproxy-combined.cql; \
	done \

setup: clean farscape-combined.cql rproxy-combined.cql

clean:
	rm -f *-combined.cql
