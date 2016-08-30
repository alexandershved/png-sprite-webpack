var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var mkdirp = require('mkdirp');

module.exports = {
  BaseDirName: 'F0UNKNOWNNAME0K',

  getPiece: function(item, slice, _sign) {
    var sign = _sign || '';
    var splits = item.split(sign);
    var length = splits.length;

    return splits[length - slice];
  },

  checkDir: function(_path, callback) {
    fs.exists(_path, function(exists) {
      if (!exists) {
        mkdirp(_path, function(err) {
          if (err) {
            throw err;
          } else {
            callback && callback();
          }
        });
      } else {
        callback && callback();
      }
    });
  },

  deleteDir: function(files, _path) {
    var list = [];

    files.forEach(function(file) {
      if (!fs.statSync(path.join(_path, file)).isDirectory()) {
        list.push(file);
      }
    });

    return list;
  },

  backslashToSlash: function(item) {
    return item.replace(/\\/g, '\/');
  },

  isImage: function(filename) {
    var imageTypes = ['png', 'jpg', 'jpeg', 'gif'];
    var ext = filename.split('.').pop();

    return _.include(imageTypes, ext);
  },

  skan: function(dir) {
    var self = this;
    var recursiveDir = {};

    var handleWalk = function(_dir, sign) {
      var list = fs.readdirSync(_dir);

      list.forEach(function(file) {
        var innerDir = path.join(_dir, file);
        var stat = fs.statSync(innerDir);

        if (sign) {
          if (!recursiveDir[sign]) {
            recursiveDir[sign] = [];
          }

          if (!stat.isDirectory()) {
            if (!self.isImage(file)) {
              return;
            }

            recursiveDir[sign].push({
              file: file,
              path: _dir
            });
          }
        }

        if (stat && stat.isDirectory()) {
          handleWalk(innerDir, file);
        } else {
          if (!sign) {
            if (!recursiveDir[self.BaseDirName]) {
              recursiveDir[self.BaseDirName] = [];
            }

            if (!self.isImage(file)) {
              return;
            }

            recursiveDir[self.BaseDirName].push({
              file: file,
              path: _dir
            });
          }
        }
      });
    };

    handleWalk(dir);

    _.forIn(recursiveDir, function(v, i) {
      if (_.isEmpty(v)) {
        delete recursiveDir[i];
      }
    });

    return recursiveDir;
  },
};
