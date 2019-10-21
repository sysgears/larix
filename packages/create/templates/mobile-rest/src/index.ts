declare let ErrorUtils: any;

try {
  require('./AwakeInDevApp');
} catch (e) {
  if (typeof ErrorUtils !== 'undefined') {
    ErrorUtils.reportFatalError(e);
  } else {
    console.error(e);
  }
}
