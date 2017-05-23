/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/

(function ($, Drupal, drupalSettings, CKEDITOR) {

  'use strict';

  function parseAttributes(editor, element) {
    var parsedAttributes = {};

    var domElement = element.$;
    var attribute;
    var attributeName;
    for (var attrIndex = 0; attrIndex < domElement.attributes.length; attrIndex++) {
      attribute = domElement.attributes.item(attrIndex);
      attributeName = attribute.nodeName.toLowerCase();

      if (attributeName.indexOf('data-cke-') === 0) {
        continue;
      }

      parsedAttributes[attributeName] = element.data('cke-saved-' + attributeName) || attribute.nodeValue;
    }

    if (parsedAttributes.class) {
      parsedAttributes.class = CKEDITOR.tools.trim(parsedAttributes.class.replace(/cke_\S+/, ''));
    }

    return parsedAttributes;
  }

  function getAttributes(editor, data) {
    var set = {};
    for (var attributeName in data) {
      if (data.hasOwnProperty(attributeName)) {
        set[attributeName] = data[attributeName];
      }
    }

    set['data-cke-saved-href'] = set.href;

    var removed = {};
    for (var s in set) {
      if (set.hasOwnProperty(s)) {
        delete removed[s];
      }
    }

    return {
      set: set,
      removed: CKEDITOR.tools.objectKeys(removed)
    };
  }

  CKEDITOR.plugins.add('drupallink', {
    icons: 'drupallink,drupalunlink',
    hidpi: true,

    init: function init(editor) {
      editor.addCommand('drupallink', {
        allowedContent: {
          a: {
            attributes: {
              '!href': true
            },
            classes: {}
          }
        },
        requiredContent: new CKEDITOR.style({
          element: 'a',
          attributes: {
            href: ''
          }
        }),
        modes: { wysiwyg: 1 },
        canUndo: true,
        exec: function exec(editor) {
          var drupalImageUtils = CKEDITOR.plugins.drupalimage;
          var focusedImageWidget = drupalImageUtils && drupalImageUtils.getFocusedWidget(editor);
          var linkElement = getSelectedLink(editor);

          var existingValues = {};
          if (linkElement && linkElement.$) {
            existingValues = parseAttributes(editor, linkElement);
          } else if (focusedImageWidget && focusedImageWidget.data.link) {
              existingValues = CKEDITOR.tools.clone(focusedImageWidget.data.link);
            }

          var saveCallback = function saveCallback(returnValues) {
            if (focusedImageWidget) {
              focusedImageWidget.setData('link', CKEDITOR.tools.extend(returnValues.attributes, focusedImageWidget.data.link));
              editor.fire('saveSnapshot');
              return;
            }

            editor.fire('saveSnapshot');

            if (!linkElement && returnValues.attributes.href) {
              var selection = editor.getSelection();
              var range = selection.getRanges(1)[0];

              if (range.collapsed) {
                var text = new CKEDITOR.dom.text(returnValues.attributes.href.replace(/^mailto:/, ''), editor.document);
                range.insertNode(text);
                range.selectNodeContents(text);
              }

              var style = new CKEDITOR.style({ element: 'a', attributes: returnValues.attributes });
              style.type = CKEDITOR.STYLE_INLINE;
              style.applyToRange(range);
              range.select();

              linkElement = getSelectedLink(editor);
            } else if (linkElement) {
                for (var attrName in returnValues.attributes) {
                  if (returnValues.attributes.hasOwnProperty(attrName)) {
                    if (returnValues.attributes[attrName].length > 0) {
                      var value = returnValues.attributes[attrName];
                      linkElement.data('cke-saved-' + attrName, value);
                      linkElement.setAttribute(attrName, value);
                    } else {
                        linkElement.removeAttribute(attrName);
                      }
                  }
                }
              }

            editor.fire('saveSnapshot');
          };

          var dialogSettings = {
            title: linkElement ? editor.config.drupalLink_dialogTitleEdit : editor.config.drupalLink_dialogTitleAdd,
            dialogClass: 'editor-link-dialog'
          };

          Drupal.ckeditor.openDialog(editor, Drupal.url('editor/dialog/link/' + editor.config.drupal.format), existingValues, saveCallback, dialogSettings);
        }
      });
      editor.addCommand('drupalunlink', {
        contextSensitive: 1,
        startDisabled: 1,
        requiredContent: new CKEDITOR.style({
          element: 'a',
          attributes: {
            href: ''
          }
        }),
        exec: function exec(editor) {
          var style = new CKEDITOR.style({ element: 'a', type: CKEDITOR.STYLE_INLINE, alwaysRemoveElement: 1 });
          editor.removeStyle(style);
        },
        refresh: function refresh(editor, path) {
          var element = path.lastElement && path.lastElement.getAscendant('a', true);
          if (element && element.getName() === 'a' && element.getAttribute('href') && element.getChildCount()) {
            this.setState(CKEDITOR.TRISTATE_OFF);
          } else {
            this.setState(CKEDITOR.TRISTATE_DISABLED);
          }
        }
      });

      editor.setKeystroke(CKEDITOR.CTRL + 75, 'drupallink');

      if (editor.ui.addButton) {
        editor.ui.addButton('DrupalLink', {
          label: Drupal.t('Link'),
          command: 'drupallink'
        });
        editor.ui.addButton('DrupalUnlink', {
          label: Drupal.t('Unlink'),
          command: 'drupalunlink'
        });
      }

      editor.on('doubleclick', function (evt) {
        var element = getSelectedLink(editor) || evt.data.element;

        if (!element.isReadOnly()) {
          if (element.is('a')) {
            editor.getSelection().selectElement(element);
            editor.getCommand('drupallink').exec();
          }
        }
      });

      if (editor.addMenuItems) {
        editor.addMenuItems({
          link: {
            label: Drupal.t('Edit Link'),
            command: 'drupallink',
            group: 'link',
            order: 1
          },

          unlink: {
            label: Drupal.t('Unlink'),
            command: 'drupalunlink',
            group: 'link',
            order: 5
          }
        });
      }

      if (editor.contextMenu) {
        editor.contextMenu.addListener(function (element, selection) {
          if (!element || element.isReadOnly()) {
            return null;
          }
          var anchor = getSelectedLink(editor);
          if (!anchor) {
            return null;
          }

          var menu = {};
          if (anchor.getAttribute('href') && anchor.getChildCount()) {
            menu = { link: CKEDITOR.TRISTATE_OFF, unlink: CKEDITOR.TRISTATE_OFF };
          }
          return menu;
        });
      }
    }
  });

  function getSelectedLink(editor) {
    var selection = editor.getSelection();
    var selectedElement = selection.getSelectedElement();
    if (selectedElement && selectedElement.is('a')) {
      return selectedElement;
    }

    var range = selection.getRanges(true)[0];

    if (range) {
      range.shrink(CKEDITOR.SHRINK_TEXT);
      return editor.elementPath(range.getCommonAncestor()).contains('a', 1);
    }
    return null;
  }

  CKEDITOR.plugins.drupallink = {
    parseLinkAttributes: parseAttributes,
    getLinkAttributes: getAttributes
  };
})(jQuery, Drupal, drupalSettings, CKEDITOR);