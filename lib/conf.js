module.exports = {
  prefix: 'sprite',
  name: 'sprite',
  orientation: 'vertical',
  background: '#ffffff',
  format: 'png',
  source: process.cwd() + '/sprites/',
  source2x: null,
  outputCss: process.cwd() + '/styles/',
  outputImg: process.cwd() + '/images/',
  processor: 'css',
  opacity: 0,
  multipath: true,
  ending2x: '@2x',
  template: null,
  resolvedPath: true
};
