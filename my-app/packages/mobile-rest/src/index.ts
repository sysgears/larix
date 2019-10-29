declare let ErrorUtils: any;

try {
  Object.assign(global, require('../build.config'));

  require('./AwakeInDevApp');
} catch (e) {
  if (typeof ErrorUtils !== 'undefined') {
    ErrorUtils.reportFatalError(e);
  } else {
    console.error(e);
  }
}
