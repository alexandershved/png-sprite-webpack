var Sprite = require('./lib/sprite-webpack');
var _ = require('lodash');

function SpriteWebpackPlugin(options) {
  var opt = Sprite.options;
  this.options = _.assign(opt, options);
}

SpriteWebpackPlugin.prototype.apply = function() {
  var self = this;
  var opt = self.options;
  var newOpt = _.clone(opt, true);

  newOpt = _.assign(newOpt, {
    source: opt.source + 'scaled-at-200/',
    spriteName: opt.spriteName + '@2x'
  });

  Sprite.createStyles(opt);
  Sprite.createImage(opt);
  Sprite.createImage(newOpt);
  Sprite.addImport(opt);
};

module.exports = SpriteWebpackPlugin;
