/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/

(function ($, Drupal, window) {

  'use strict';

  Drupal.behaviors.trackerHistory = {
    attach: function attach(context) {
      var nodeIDs = [];
      var $nodeNewPlaceholders = $(context).find('[data-history-node-timestamp]').once('history').filter(function () {
        var nodeTimestamp = parseInt(this.getAttribute('data-history-node-timestamp'), 10);
        var nodeID = this.getAttribute('data-history-node-id');
        if (Drupal.history.needsServerCheck(nodeID, nodeTimestamp)) {
          nodeIDs.push(nodeID);
          return true;
        } else {
          return false;
        }
      });

      var $newRepliesPlaceholders = $(context).find('[data-history-node-last-comment-timestamp]').once('history').filter(function () {
        var lastCommentTimestamp = parseInt(this.getAttribute('data-history-node-last-comment-timestamp'), 10);
        var nodeTimestamp = parseInt(this.previousSibling.previousSibling.getAttribute('data-history-node-timestamp'), 10);

        if (lastCommentTimestamp === nodeTimestamp) {
          return false;
        }
        var nodeID = this.previousSibling.previousSibling.getAttribute('data-history-node-id');
        if (Drupal.history.needsServerCheck(nodeID, lastCommentTimestamp)) {
          if (nodeIDs.indexOf(nodeID) === -1) {
            nodeIDs.push(nodeID);
          }
          return true;
        } else {
          return false;
        }
      });

      if ($nodeNewPlaceholders.length === 0 && $newRepliesPlaceholders.length === 0) {
        return;
      }

      Drupal.history.fetchTimestamps(nodeIDs, function () {
        processNodeNewIndicators($nodeNewPlaceholders);
        processNewRepliesIndicators($newRepliesPlaceholders);
      });
    }
  };

  function processNodeNewIndicators($placeholders) {
    var newNodeString = Drupal.t('new');
    var updatedNodeString = Drupal.t('updated');

    $placeholders.each(function (index, placeholder) {
      var timestamp = parseInt(placeholder.getAttribute('data-history-node-timestamp'), 10);
      var nodeID = placeholder.getAttribute('data-history-node-id');
      var lastViewTimestamp = Drupal.history.getLastRead(nodeID);

      if (timestamp > lastViewTimestamp) {
        var message = lastViewTimestamp === 0 ? newNodeString : updatedNodeString;
        $(placeholder).append('<span class="marker">' + message + '</span>');
      }
    });
  }

  function processNewRepliesIndicators($placeholders) {
    var placeholdersToUpdate = {};
    $placeholders.each(function (index, placeholder) {
      var timestamp = parseInt(placeholder.getAttribute('data-history-node-last-comment-timestamp'), 10);
      var nodeID = placeholder.previousSibling.previousSibling.getAttribute('data-history-node-id');
      var lastViewTimestamp = Drupal.history.getLastRead(nodeID);

      if (timestamp > lastViewTimestamp) {
        placeholdersToUpdate[nodeID] = placeholder;
      }
    });

    var nodeIDs = Object.keys(placeholdersToUpdate);
    if (nodeIDs.length === 0) {
      return;
    }
    $.ajax({
      url: Drupal.url('comments/render_new_comments_node_links'),
      type: 'POST',
      data: { 'node_ids[]': nodeIDs },
      dataType: 'json',
      success: function success(results) {
        for (var nodeID in results) {
          if (results.hasOwnProperty(nodeID) && placeholdersToUpdate.hasOwnProperty(nodeID)) {
            var url = results[nodeID].first_new_comment_link;
            var text = Drupal.formatPlural(results[nodeID].new_comment_count, '1 new', '@count new');
            $(placeholdersToUpdate[nodeID]).append('<br /><a href="' + url + '">' + text + '</a>');
          }
        }
      }
    });
  }
})(jQuery, Drupal, window);