// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//     You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//     See the License for the specific language governing permissions and
// limitations under the License.

(function(shared, scope, testing) {

  function groupChildDuration(node) {
    return node.timing.delay + node.activeDuration + node.timing.endDelay;
  };

  function KeyframeEffect(effect) {
    this._frames = shared.normalizeKeyframes(effect);
  }

  KeyframeEffect.prototype = {
    getFrames: function() { return this._frames; }
  };

  window.Animation = function(target, effect, timingInput) {
    this.target = target;
    // TODO: Make modifications to specified update the underlying player
    this.timing = shared.normalizeTimingInput(timingInput);
    // TODO: Make this a live object - will need to separate normalization of
    // keyframes into a shared module.
    if (typeof effect == 'function')
      this.effect = effect;
    else
      this.effect = new KeyframeEffect(effect);
    this._effect = effect;
    this._internalPlayer = null;
    this.activeDuration = shared.calculateActiveDuration(this.timing);
    return this;
  };

  var pendingGroups = [];
  scope.awaitStartTime = function(groupPlayer) {
    if (!isNaN(groupPlayer.startTime) || !groupPlayer._isGroup)
      return;
    if (pendingGroups.length == 0) {
      requestAnimationFrame(updatePendingGroups);
    }
    pendingGroups.push(groupPlayer);
  };
  function updatePendingGroups() {
    var updated = false;
    while (pendingGroups.length) {
      pendingGroups.shift()._updateChildren();
      updated = true;
    }
    return updated;
  }
  var originalGetComputedStyle = window.getComputedStyle;
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    enumerable: true,
    value: function() {
      var result = originalGetComputedStyle.apply(this, arguments);
      if (updatePendingGroups())
        result = originalGetComputedStyle.apply(this, arguments);
      return result;
    },
  });

  // TODO: Call into this less frequently.
  scope.Player.prototype._updateChildren = function() {
    if (isNaN(this.startTime) || !this.source || !this._isGroup)
      return;
    var offset = this.source.timing.delay;
    for (var i = 0; i < this.source.children.length; i++) {
      var child = this.source.children[i];
      var childPlayer;

      if (i >= this._childPlayers.length) {
        childPlayer = window.document.timeline.play(child);
        child.player = this.source.player;
        this._childPlayers.push(childPlayer);
      } else {
        childPlayer = this._childPlayers[i];
      }

      if (childPlayer.startTime != this.startTime + offset) {
        childPlayer.startTime = this.startTime + offset;
        childPlayer._updateChildren();
      }

      if (this.playbackRate == -1 && this.currentTime < offset && childPlayer.currentTime !== -1) {
        childPlayer.currentTime = -1;
      }

      if (this.source instanceof window.AnimationSequence)
        offset += groupChildDuration(child);
    }
  };

  window.document.timeline.play = function(source) {
    // TODO: Handle effect callback.
    if (source instanceof window.Animation) {
      // TODO: Handle null target.
      var player = source.target.animate(source._effect, source.timing);
      player.source = source;
      source.player = player;
      return player;
    }
    // FIXME: Move this code out of this module
    if (source instanceof window.AnimationSequence || source instanceof window.AnimationGroup) {
      var ticker = function(tf) {
        if (!player.source)
          return;
        if (tf == null) {
          player._removePlayers();
          return;
        }
        if (isNaN(player.startTime))
          return;

        player._updateChildren();
      };


      // TODO: Use a single static element rather than one per group.
      var player = document.createElement('div').animate(ticker, source.timing);
      player.source = source;
      player._isGroup = true;
      source.player = player;
      scope.awaitStartTime(player);
      return player;
    }
  };

  scope.groupChildDuration = groupChildDuration;

}(webAnimationsShared, webAnimationsMaxifill, webAnimationsTesting));
