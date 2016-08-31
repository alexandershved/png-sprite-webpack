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

function checkSource(opt) {
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
          if (dir !== util.BaseDirName && !opt.multipath) {
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
    if (opt.source.indexOf(opt.source2x) !== -1) {
      writeError('Folder with scalable images are in ' + opt.source);
      flag = false;
    }

    filelist = scanScaledImages(opt.source);
    filelist2x = scanScaledImages(opt.source2x);

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
            writeError('File ' + opt.source + _file + ' has no match in the ' + _path);
            flag = false;
          }
        });
      };

      check(opt.source2x, filelist2x, opt.ending2x);
    }
  } catch(err) {
    throw err;
  }

  return flag;
}

function updateLayer(opt) {
  var orientation;
  var layers = [];

  if (opt.orientation === 'vertical') {
    orientation = 'top-down';
  } else if (opt.orientation === 'horizontal') {
    orientation = 'left-right';
  } else {
    orientation = 'binary-tree';
  }

  _.forEach([opt.source, opt.source2x], function(source) {
    var images;
    var layer;

    if (source) {
      images = getImages(opt, source);
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

function getImages(opt, source) {
  var images = [];
  var excludes = ['.DS_Store'];
  var files = util.skan(source);

  _.forIn(files, function(dirFiles, dirName) {
    if (dirName !== util.BaseDirName && !opt.multipath) {
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

function createStyles(opt) {
  var content = getStyles(opt);

  util.checkDir(opt.outputCss, function() {
    var _path;

    if (opt.processor === 'stylus') {
      opt.processor = 'styl';
    }

    _path = path.join(opt.outputCss, opt.name + '.' + opt.processor);

    fs.writeFile(_path, content, function(err) {
      if (err) {
        throw err;
      }
    });
  });
}

function getStyles(opt) {
  var names = [];
  var _path = '';
  var styles = [];
  var styles2x = [];
  var groups2x = [];
  var params;

  if (!opt.resolvedPath) {
    _path = path.relative(opt.outputCss, opt.outputImg);
  }

  _.forEach(opt.info[0].items, function(item) {
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

  if (opt.source2x) {
    _.forEach(opt.info[1].items, function(item, i) {
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
      width: opt.info[0].width,
      height: opt.info[0].height,
      image: path.join(_path, opt.name + '.' + opt.format)
    }
  };

  if (opt.source2x) {
    params.retina_sprites = styles2x;
    params.retina_spritesheet = {
      width: opt.info[1].width,
      height: opt.info[1].height,
      image: path.join(_path, opt.name + opt.ending2x + '.' + opt.format)
    };
    params.retina_groups = groups2x;
  }

  return templater(params, {
    format: 'sprite',
    formatOpts: {
      'cssClass': opt.prefix,
      'processor': opt.processor,
      'retina': opt.source2x ? opt.ending2x : false
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
  var options = _.merge({}, opts);

  this.options = _.assign(options, opt);
  this.options.color = new color(this.options.background);

  if (this.options.opacity === 0 && this.options.format === 'jpg') {
    this.options.opacity = 1;
  }

  this.options.color = this.options.color.rgbArray();
  this.options.color.push(this.options.opacity);
}

SpriteWebpackPlugin.prototype.apply = function(compiler) {
  var fill;
  var self = this;

  if (!checkSource(this.options)) {
    return;
  }

  if (!this.options.info) {
    this.options.info = updateLayer(this.options);
  }

  util.checkDir(this.options.outputImg);

  fill = function(ending, i) {
    var index = 0;
    var layer;
    var length;
    var checkError;
    var pasteImage;
    var addItem;

    if (!self.options.info[i]) {
      return;
    }

    layer = self.options.info[i];
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
          output.writeFile(path.join(self.options.outputImg, self.options.name + ending + '.' + self.options.format), function() {});
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
      self.options.color,
      addItem
    );
  };

  _.forEach(['', this.options.ending2x], fill);

  createStyles(this.options);
};

module.exports = SpriteWebpackPlugin;
