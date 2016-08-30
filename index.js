var _ = require('lodash');
var fs = require('fs');
var lwip = require('lwip');
var path = require('path');
var color = require('color');
var layout = require('layout');
var imageinfo = require('imageinfo');
var templater = require('spritesheet-templates');

var util = require('./lib/util');
var opts = require('./lib/conf');

templater.addTemplate('sprite', require('./lib/tpl.js'));

function writeError(str) {
  process.stdout.write('\n\n\u001b[1m\u001b[31m' + str + '\u001b[39m\u001b[22m\n\n');
}

function initOpts(options) {
  options.color = new color(options.background);

  if (options.opacity === 0 && options.format === 'jpg') {
    options.opacity = 1;
  }

  options.color = options.color.rgbArray();
  options.color.push(options.opacity);

  opts = _.assign({}, opts, options);
}

function checkSource() {
  var excludes = ['.DS_Store'];
  var flag = true;
  var filelist = [];
  var filelist2x;
  var check;

  var scanScaledImages = function(_path) {
    var list;
    var res;

    if (_path) {
      list = [];

      if (_.isEmpty(fs.readdirSync(_path))) {
        flag = false;
      } else {
        res = util.skan(_path);

        _.forEach(res, function(items, dir) {
          if (dir !== util.BaseDirName && !opts.multipath) {
            return;
          }

          _.forEach(items, function(item) {
            if (!_.includes(excludes, item.file)) {
              list.push(item.file);
            }
          });
        });
      }
    } else {
      list = false;
    }

    return list;
  };

  try {
    if (opts.source.indexOf(opts.source2x) !== -1) {
      writeError('Folder with scalable images are in ' + opts.source);
      flag = false;
    }

    filelist = scanScaledImages(opts.source);
    filelist2x = scanScaledImages(opts.source2x);

    if (_.isEmpty((_.pull(filelist, '.DS_Store')))) {
      flag = false;
    } else {
      check = function(_path, _list, _ending) {
        if (!_list) {
          return;
        }

        _.forEach(filelist, function(_file) {
          var file = _file.split('.');
          var ext = file.pop();

          file = file.join('.') + _ending + '.' + ext;

          if (_list.indexOf(file) === -1) {
            writeError('File ' + opts.source + _file + ' has no match in the ' + _path);
            flag = false;
          }
        });
      };

      check(opts.source2x, filelist2x, opts.ending2x);
    }
  } catch(err) {
    throw err;
  }

  return flag;
}

function updateLayer() {
  var orientation;
  var layers = [];

  if (opts.orientation === 'vertical') {
    orientation = 'top-down';
  } else if (opts.orientation === 'horizontal') {
    orientation = 'left-right';
  } else {
    orientation = 'binary-tree';
  }

  _.forEach([opts.source, opts.source2x], function(source) {
    var images;
    var layer;

    if (source) {
      images = getImages(source);
      layer = layout(orientation);

      _.forEach(images, function(image) {
        layer.addItem({
          'height': image.height,
          'width': image.width,
          'meta': {
            name: image.name,
            dir: image.dir,
            path: image.path,
            buffer: image.buffer,
          }
        });
      });

      layers.push(layer.export());
    } else {
      layers.push(null);
    }
  });

  return layers;
}

function getImages(source) {
  var images = [];
  var excludes = ['.DS_Store'];
  var files = util.skan(source);

  _.forIn(files, function(dirFiles, dirName) {
    if (dirName !== util.BaseDirName && !opts.multipath) {
      return;
    }

    dirFiles.forEach(function(value) {
      var _path = value.path;
      var _file = value.file;
      var fullPath;
      var name;

      if (_.includes(excludes, _file)) {
        return;
      }

      fullPath = path.join(_path, _file);
      name = util.getPiece(_file, 2, '.');

      collectImages({
        name: name,
        path: _path,
        fullPath: fullPath,
        list: images,
      });
    });
  });

  return images;
}

function collectImages(image) {
  var types = ['png', 'jpg', 'jpeg', 'gif'];
  var buffer = fs.readFileSync(image.fullPath);
  var meta = imageinfo(buffer);
  var format;

  if (!meta.format) {
    return;
  }

  format = meta.format.toLowerCase();

  if (_.includes(types, format)) {
    image.list.push({
      name: image.name,
      dir: image.dir,
      path: image.fullPath,
      width: meta.width,
      height: meta.height,
      buffer: buffer,
    });
  }
}

function createStyles() {
  var content = getStyles();

  util.checkDir(opts.outputCss, function() {
    var _path;

    if (opts.processor === 'stylus') {
      opts.processor = 'styl';
    }

    _path = path.join(opts.outputCss, opts.name + '.' + opts.processor);

    fs.writeFile(_path, content, function(err) {
      if (err) {
        throw err;
      }
    });
  });
}

function getStyles() {
  var names = [];
  var _path = '';
  var styles = [];
  var styles2x = [];
  var groups2x = [];
  var params;

  if (!opts.resolvedPath) {
    _path = path.relative(opts.outputCss, opts.outputImg);
  }

  _.forEach(opts.info[0].items, function(item) {
    var name = duplicateClassName(names, item.meta.name, item.meta.path);

    if (name) {
      styles.push({
        'name': name,
        'x': item.x,
        'y': item.y,
        'width': item.width,
        'height': item.height
      });
    }
  });

  if (opts.source2x) {
    _.forEach(opts.info[1].items, function(item, i) {
      var name = duplicateClassName(names, item.meta.name, item.meta.path);

      if (name) {
        styles2x.push({
          'name': name,
          'x': item.x,
          'y': item.y,
          'width': item.width,
          'height': item.height
        });

        groups2x.push({
          'name': name,
          index: i
        });
      }
    });
  }

  params = {
    sprites: styles,
    spritesheet: {
      width: opts.info[0].width,
      height: opts.info[0].height,
      image: path.join(_path, opts.name + '.' + opts.format)
    }
  };

  if (opts.source2x) {
    params.retina_sprites = styles2x;
    params.retina_spritesheet = {
      width: opts.info[1].width,
      height: opts.info[1].height,
      image: path.join(_path, opts.name + opts.ending2x + '.' + opts.format)
    };
    params.retina_groups = groups2x;
  }

  return templater(params, {
    format: 'sprite',
    formatOpts: {
      'cssClass': opts.prefix,
      'processor': opts.processor,
      'retina': opts.source2x ? opts.ending2x : false
    }
  });
}

function duplicateClassName(arr, name, _path) {
  var n;

  if (_.includes(arr, name)) {
    writeError('Found dublicate for ' + name + ' in ' + _path);
    n = false;
  } else {
    arr.push(name);
    n = name;
  }

  return n;
}

function SpriteWebpackPlugin(opt) {
  this.options = _.assign(opts, opt);
}

SpriteWebpackPlugin.prototype.apply = function(compiler) {
  var fill;

  initOpts(this.options);

  if (!checkSource()) {
    return;
  }

  if (!opts.info) {
    opts.info = updateLayer();
  }

  util.checkDir(opts.outputImg);

  compiler.plugin('emit', function(compilation, callback) {
    var iteration = 0;

    fill = function(ending, i) {
      var index = 0;
      var layer;
      var length;
      var checkError;
      var pasteImage;
      var addItem;

      if (!opts.info[i]) {
        return;
      }

      layer = opts.info[i];
      length = layer.items.length;

      checkError = function(err) {
        if (err) {
          throw err;
        }
      };

      pasteImage = function(err, canvas, img) {
        checkError(err);

        canvas.paste(layer.items[index].x, layer.items[index].y, img, function(_err, output) {
          if (++index < length) {
            addItem(_err, canvas);
          } else {
            output.writeFile(path.join(opts.outputImg, opts.name + ending + '.' + opts.format), function() {});
            iteration++;

            if (iteration === 2) {
              callback();
            }
          }
        });
      };

      addItem = function(err, canvas) {
        checkError(err);

        lwip.open(layer.items[index].meta.path, function(_err, img) {
          pasteImage(_err, canvas, img);
        });
      };

      lwip.create(
        layer.width,
        layer.height,
        opts.color,
        addItem
      );
    };

    _.forEach(['', opts.ending2x], fill);
  });

  createStyles();
};

module.exports = SpriteWebpackPlugin;
