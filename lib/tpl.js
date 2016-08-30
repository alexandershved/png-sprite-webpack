'use strict';

var fs = require('fs');
var cssesc = require('cssesc');
var mustache = require('mustache');

var tmpl = {
  'css': fs.readFileSync(__dirname + '/templates/css.mustache', 'utf8'),
  'scss': fs.readFileSync(__dirname + '/templates/scss.mustache', 'utf8'),
  'sass': fs.readFileSync(__dirname + '/templates/sass.mustache', 'utf8'),
  'less': fs.readFileSync(__dirname + '/templates/less.mustache', 'utf8'),
  'stylus': fs.readFileSync(__dirname + '/templates/stylus.mustache', 'utf8')
};

function cssTemplate(params) {
  var template = {
    items: []
  };

  var tmplFile;
  var css;

  params.items.forEach(function saveClass(item, i) {
    item.name = params.options.cssClass + '-' + item.name;

    if (item.name) {
      item.class = '.' + cssesc(item.name, {isIdentifier: true});
    }

    if (params.options.retina) {
      item.escaped_image_2x = params.retina_groups[i].retina.escaped_image;
    }

    template.items.push(item);
  });

  tmplFile = tmpl[params.options.processor];
  css = mustache.render(tmplFile, template);

  return css;
}

module.exports = cssTemplate;
