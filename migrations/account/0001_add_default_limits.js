/**
 * Name of the migration framework version which has generated this file.
 * DO NOT EDIT MANUALLY.
 */
exports.FRAMEWORK_VERSION = '0.1';


/**
 * Time stamp where the migration has been generated.
 * DO NOT EDIT MANUALLY.
 */
exports.TIMESTAMP = 1351277239;


/**
 * Migration version.
 * DO NOT EDIT MANUALLY.
 */
exports.VERSION = 1;


/**
 * Fields on model  at version 1.
 * Notice: DO NOT EDIT MANUALLY.
 */
exports.FIELDS = {
  "metadata": {
    "default_value": {}
  },
  "status": {
    "default_value": "active"
  },
  "limits": {
    "default_value": {
      "session": 300,
      "service": 5000,
      "configuration_value": 500
    }
  }
};


exports.forward = function(obj) {
  return obj;
};


exports.backward = function(obj) {
  return obj;
};
