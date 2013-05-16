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
exports.VERSION = 4;


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
      "session": 100,
      "service": 200,
      "configuration_value": 1000
    }
  }
};


exports.forward = function(obj) {
  obj.limits = exports.FIELDS.limits.default_value;
  return obj;
};


exports.backward = function(obj) {
  return obj;
};
