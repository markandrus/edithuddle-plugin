//     EditHuddle Plugin 0.2
 
//     (c) 2011-2012 Mark Andrus Roberts, EditHuddle

(function(){

  var namespace = 'EditHuddle';
  var $, plugin = window[namespace] = window[namespace] || {};

  // plugin.Settings
  // ---------------
  
  var Settings = plugin.Settings || {};  plugin.Settings = Settings;

  // Here are our default settings:
  Settings.version = 0.2;
  Settings.bind_to = Settings.bind_to || '.edithuddle-button';
  // Settings.root    = Settings.root    || 'http://127.0.0.1:8000';
  Settings.root    = Settings.root    || 'http://www.edithuddle.com';
  Settings.debug   = typeof Settings.debug != 'undefined' ?
    Settings.debug : true;

  // Internal: this setting should only be set when loading this script in an IFrame as a bubble.
  Settings._bubble = typeof Settings._bubble != 'undefined' ?
    Settings._bubble : false;

  // plugin.DependencyLoader
  // -----------------------

  // Provides `load` for loading plugin dependencies (for format see plugin.dependencies).
  var DependencyLoader = plugin.DependencyLoader = {

    // Internal method for loading a dependency.
    _load: function(dep) {
      if (!dep.loaded() || eval(dep.constraint)) {
        var script_tag = document.createElement('script');
        script_tag.setAttribute('type', 'text/javascript');
        script_tag.setAttribute('src', dep.src);
        script_tag.setAttribute('async', true);
        // Run callback() once script has loaded
        script_tag.onload = dep.callback;
        // Same thing but for IE
        script_tag.onreadystatechange = function () {
          if (this.readyState == 'complete' || this.readyState == 'loaded')
            dep.callback();
        };
        document.getElementsByTagName('body')[0].appendChild(script_tag);
      } else {
        dep.callback();
      }
    },

    // Load plugin dependencies (for format see `plugin.dependencies`).
    load: function(deps) {
      for (var d in deps)
        this._load(deps[d]);
    }

  };

  // plugin.dependencies
  // -------------------
  
  // A list of dependencies for our plugin. Dependencies are declared in the following format:
  //
  //     Name of JavaScript dependency: {
  //       loaded: Function that returns a Boolean,
  //       constraint: Either false or a string of JavaScript that `eval`s to a Boolean,
  //       src: URL of JavaScript dependency,
  //       callback: Function to be executed once the dependency is satisified }
  //
  var dependencies = plugin.dependencies = {

    // Require jQuery >= 1.7.1.
    jQuery: {
      loaded: function() { return typeof jQuery != 'undefined'; },
      constraint: '!/[1-9]\.[7-9].[1-9]/.test(jQuery.fn.jquery)', 
      src: '//ajax.googleapis.com/ajax/libs/jquery/1.7/jquery.min.js',
      callback: function() {
        $ = jQuery;
        // See `jQuery.dependencies` as specified below.
        if (Settings._bubble == false)
          DependencyLoader.load(dependencies.jQuery.dependencies);
      }
    },

    json: {
      loaded: function() { return typeof window.JSON != 'undefined'; },
      constraint: false,
      src: '//ajax.cdnjs.com/ajax/libs/json2/20110223/json2.js',
      callback: function() {
        DependencyLoader.load(dependencies.json.dependencies);
      }
    },

    // Require ierange (for Internet Explorer).
    ierange: {
      loaded: function() { return typeof window.getSelection != 'undefined'; },
      constraint: false,
      src: '//ierange.googlecode.com/files/ierange-m2-packed.js',
      callback: function() { }
    }

  };

  dependencies.json.dependencies = {

    // Require easyXDM.
    easyXDM: {
      loaded: function() { return typeof easyXDM != 'undefined'; },
      constraint: false,
      src: '//easyxdm.net/current/easyXDM.js',
      // NOTE: 
      callback: function() {
        if (Settings._bubble === true) {
          var rpc = new easyXDM.Rpc({}, RPC._provider);
          RPC.rpc = rpc;
        } else {
          var rpc = new easyXDM.Rpc({
            remote: Settings.root + '/plugin/thanks',
            channel: 'rpc'
          }, RPC._consumer);
          RPC.rpc = rpc;
        }
      }
    }

  };

  // The following dependencies rely on and are loaded after jQuery.
  dependencies.jQuery.dependencies = {

    // FIXME: Eventually incorporate this functionality directly into our plugin.
    textselectevent: {
      loaded: function() { return false; },
      constraint: false,
      // src: 'https://raw.github.com/peol/jquery-text-selection-special-event/master/jquery.textselectevent.js',
      src: 'https://raw.github.com/markandrus/jquery-text-selection-special-event/patch-1/jquery.textselectevent.js',
      callback: function() {
        $(document).on('textselect.edithuddle-listener', function(selectionEvent, selectionString, selectionContainer) {
          var container = {
            postKey: StateMachine.vars.postKey,
            text: selectionContainer.innerText || selectionContainer.textContent
          }, submission = {
            selection: selectionString,
            category: undefined,
            suggestion: undefined
          };
          StateMachine.vars.container = container;
          StateMachine.vars.submission = submission;
          StateMachine.vars.selectionEvent = selectionEvent;
        });
        // NOTE: Now we initialize our state machine (but not before `easyXDM` has loaded).
        Utilities.waitUntil(dependencies.json.dependencies.easyXDM.loaded, StateMachine.state.init);
      }
    }

  };

  // plugin.Utilities
  // ----------------

  // Provides utility functions for our plugin.
  var Utilities = plugin.Utilities = {

    // Test `condition()`, waiting 1.5 times longer than the previous wait time. If `condition()`
    // evaluates to `true`, execute `callback`. The wait time is optional (default: 100 ms).
    waitUntil: function(condition, callback, wait) {
      if (typeof wait === 'undefined') wait = 100;
      if (!condition()) {
        setTimeout(function() {
          Utilities.waitUntil(condition, callback, wait * 1.5);
        }, wait);
      } else {
        callback();
      }
    },

    // Return the value associated with a given key in the URL of the current window, e.g. if our
    // plugin is running at `http://localhost/?key=value`
    //
    //     getFromQueryString('key') === 'value'
    //
    getFromQueryString: function(key) {
      var vars = [], hash, i
          hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
      for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
      }
      if (typeof key == 'undefined')
        return vars;
      else
        return vars[key];
    },

    // Return the query string representation of a `{key: value}` object, e.g.
    //
    //     makeQueryString({next: '/profile'}) === '?next=/profile'
    //
    makeQueryString: function(kvs) {
      var str = '', c = '?';
      for (var k in kvs) {
        str += c + k + '=' + encodeURI(kvs[k]);
        c = '&';
      }
      return str;
    }

  };

  // plugin.IFrame
  // -------------
  
  // `IFrame` provides shorthand notation/utility functions within our `bubbles`, e.g. the close
  // button within a bubble might look like:
  //
  //     <a href="javascript:EditHuddle.IFrame.previous()">Close</a>
  //     
  //  Additionally, since we are using `easyXDM`, we can't just reload with
  //  `window.location.reload()`, otherwise our `RPC` object dies; instead, we must create a new
  //  `RPC`. This function is typically called when logging in and out through "the button".
  var IFrame = plugin.IFrame = {

    toggleHeatMap: function() { RPC.rpc.toggleHeatMap(); },

    // Shorthand for the `RPC` functions below.
    reload:   function() { RPC.rpc.reload(); },
    next: function(args) { RPC.rpc.StateMachine_state_next(args); },
    previous: function() { RPC.rpc.StateMachine_state_previous(); },

    // Once the user logs in, they are redirected to `/plugin/reload`. After calling
    // `window.opener.IFrame.reload()`, the window closes.
    login: function() {
      window.open(Settings.root + '/accounts/login?next=/plugin/reload', 'login-window',
        'width=1024,height=540');
    },

    // Log the user out (via AJAX), before reloading the IFrame.
    logout: function() {
      $.ajax({
        type: 'POST',
        url: Settings.root + '/accounts/logout/',
        // Reload the iframe on logout.
        success: function() { RPC.rpc.reload(); }
      });
    }

  };
  
  // plugin.RPC
  // ----------
  
  var RPC = plugin.RPC = {

    // In order to reduce duplicate code, we instantiate `_consumer` and `_producer` as empty.
    // `init` will populate these with `_methods` according to the format specified by `easyXDM`
    // (see below).
    _consumer: { local: {}, remote: {} },
    _provider: { local: {}, remote: {} },

    // For each method in `_methods`, populate `_consumer` and `_provider` with the appropriate
    // methods or stubs.
    init: function() {
      for (var m in this._iframe_methods) {
        // Set the method.
        this._consumer.local[m]  = this._iframe_methods[m];
        // Set the stub.
        this._provider.remote[m] = {};
      }
      for (var m in this._plugin_methods) {
        // Set the method.
        this._provider.local[m]  = this._plugin_methods[m];
        // Set the stub.
        this._consumer.remote[m] = {};
      }
    },

    // The following are methods callable from our IFrames/bubbles.
    _iframe_methods: {

      // toggleHeatMap: function() { RPC.rpc.getSubmissions(); },
      toggleHeatMap: function() { /*RPC.rpc.getSubmissions();*/ HeatMap.toggle() },

      // `StateMachine` RPC calls:
      StateMachine_state_next: function(args) { StateMachine.state.next(args); },
      StateMachine_state_previous: function() { StateMachine.state.previous(); },

      // Reload the bubble.
      reload: function() {
        var rpcs = [];
        for (var b in UI.bubbles) {
          // rpcs.push(UI.bubbles[b].rpc);
          // $(UI.bubbles[b].node).remove();
          UI.bubbles[b].rpc.destroy();
          UI.init(b);
        }
        StateMachine.state.init();
        //for (var i = 0; i < rpcs.length; i++)
        //  rpcs[i].destroy();
      },

      console_log: function(obj) { /*console.log(obj);*/ },

      wrap_selections: function(selections) {
        for (var i = 0; i < selections.length; i++)
          Text.wrapTextNodes(Text.getTextNodesContaining(selections[i]));
      },

      HeatMap__load: function(postKey, submissions) {
        HeatMap._load(postKey, submissions);
      }

    },

    // The following are methods callable from our plugin.
    _plugin_methods: {

      getSubmissions: function(blogKey, postKey, lastID) {
        var getParams = {
          format: 'json',
          limit: 100,
          post__blog__key: blogKey,
          post__key: postKey
        };
        var url = Settings.root + "/api/v1/submissioncontainer/" + Utilities.makeQueryString(getParams);
        $.getJSON(url, function(data) {
          RPC.rpc.HeatMap__load(postKey, data.objects);
        });
        if (typeof lastID == 'number') {
          getParams.id__gte = lastID;
        }
      },

      postData: function(urlFragment, data) {
        $.ajax({
          type: 'POST',
          url: Settings.root + urlFragment,
          data: data,
          success: function(e) { /*console.log(e);*/ }
        });
      },

      resetForms: function() {
        $('input:text, input:password, input:file, select, textarea').val('');
        $('input:radio, input:checkbox').removeAttr('checked').removeAttr('selected');
      }

    }

  };

  with (RPC) { init(); }

  // plugin.UI
  // ---------
  
  var UI = plugin.UI = {

    // "Bubbles" drive our plugin's UI. A bubble is an absolutely-positioned IFrame (see definition
    // of `makeBubble` below).
    init: function(name) {
      if (typeof name == 'undefined') {
        for (var b in this._bubbles)
          this.bubbles[b] = this._makeBubble(this._bubbles[b]);
      } else {
        this.bubbles[name] = this._makeBubble(this._bubbles[name]);
      }
    },

    // See above. We can't instantiate these until jQuery is loaded, so we define them in `init`.
    // Bubbles take the following form:
    //
    //     bubble = { node: An IFrame DOM element (with a particular ID),
    //                rpc: An easyXDM `Rpc` object }
    //
    bubbles: {},

    // Internal: specification of the bubbles our plugin uses, formatted as follows:
    //
    //     Name of bubble: {
    //       id: ID of the IFrame to be created (also used in easyXDM channel name),
    //       src: Source URL of the IFrame,
    //       width: Width of the IFrame,
    //       height: Height of the IFrame. }
    //
    _bubbles: {
      help: {
        id: 'help',
        src: Settings.root + '/plugin/help' + Utilities.makeQueryString({
          blog: Settings.blogKey,
          key: 0
        }),
        width: '320px',
        height: '600px'
      },
      report: {
        id: 'report',
        src: Settings.root + '/plugin/report' + Utilities.makeQueryString({
          blog: Settings.blogKey
        }),
        width: '300px',
        height: '300px'
      },
      thanks: {
        id: 'thanks',
        src: Settings.root + '/plugin/thanks',
        width: '300px',
        height: '300px'
      }
    },

    // Internal: takes a bubble specification (see above) a bubble (see above).
    _makeBubble: function(bubble) {
      var rpc = new easyXDM.Rpc({
        remote: bubble.src,
        channel: bubble.id,
        props: {
          id: bubble.id,
          // Restrict scrolling, frame border, etc.
          scrolling: 'no',
          frameborder: '0',
          ALLOWTRANSPARENCY: 'true',
          outline: 'none',
          // Further styling.
          style: {
            display: 'block',
            width: bubble.width,
            height: bubble.height,
            display: 'none',
            position: 'absolute',
            'z-index': '9999'
          }
        }
      }, RPC._consumer);
      return {
        node: document.getElementById(bubble.id),
        rpc: rpc
      };
    },

    // Positions and shows a bubble at the given x and y coordinates, relative to an optional bind
    // site.
    showBubble: function(bubble, x, y, bind_site) {
      bubble.css({
        left: x+'px',
        top: y+'px'
      });
      // $(bind_site || 'body').append(bubble);
      bubble.fadeIn();
    },

    // Fades a bubble out before removing it from the page (`delay` is optional).
    hideBubble: function(bubble, delay) {
      setTimeout(function() {
        $(bubble.node).fadeOut();
        setTimeout(function() { /*$(bubble).remove();*/ }, 400);
      }, delay || 0);
    },

    // Special function for showing the help bubble relative to "the button".
    showHelpBubble: function(btn) {
      var bubble = $(this.bubbles.help.node),
          position = btn.offset();
      var x = btn.outerWidth() / 2 - 26 - 6 + position.left,
          y = btn.outerHeight() + position.top;
      this.showBubble(bubble, x, y, btn);
    },

    // Special function for showing the report bubble relative to a mouse event.
    showReportBubble: function(e) {
      var bubble = $(this.bubbles.report.node),
          x = e.pageX + 12,
          y = e.pageY - 24;
      this.showBubble(bubble, x, y);
      var dx = $(bubble).outerWidth() + x - $(window).outerWidth();
      if (dx > 0)
        $(bubble).animate({left: '-=' + dx}, 400);
    },

    // Special function for showing the report bubble at a given x and y coordinate.
    showThanksBubble: function(x, y) {
      var bubble = $(this.bubbles.thanks.node);
      this.showBubble(bubble, x, y);
    }

  };

  // plugin.StateMachine
  // -------------------

  // All of our plugin's behaviour in response to user interaction is modelled as a state machine.
  var StateMachine = plugin.StateMachine = {

    // See below.
    state: undefined,

    // See below.
    vars: {
      btn: undefined,
      postKey: undefined,
      container: undefined,
      /* { postKey: StateMachine.vars.postKey,
           text: String } */
      submission: undefined,
      /* { selection: String,
           suggestion: String (optional),
           container_offset: Integer (optional),
           category: String } */
      selectionEvent: undefined
    },

    // Internal list of all states for our plugin. States are declared in the following format:
    //
    //     Name of state: {
    //       init: an initialization function (typically sets `StateMachine.state = this`),
    //       next: a transition function to the next state,
    //       previous: a transition function to the previous state,
    //       toString: a funtion returning a string representation of the state }
    //
    _states: {

      // In `setup`, our plugin records a pageview to our server before transitioning to `inital`.
      setup: {

        init: function() {
          var state = StateMachine.state = this;
          // ...
          UI.init();
          // ...
          var btn = $(Settings.bind_to);
          btn.css('position', 'relative');
          btn.on('click.prevent-default', function(e) {
            e.preventDefault();
          });
          // Send a `view` for each peice of content loaded on the page.
          btn.each(function(i, e) {
            RPC.rpc.postData(
              '/plugin/api/view',
              { blog: Settings.blogKey,
                key: $(e).attr('data-postkey'),
                title: $(e).attr('data-posttitle'),
                url: $(e).attr('data-posturl') });
          });
          // ...
          StateMachine._states.initial.init();
        },

        toString: function() { return "setup" }

      },

      // In `initial`, our plugin binds the transition function `next` to the click event of
      // `Settings.bind_site`, AKA "the button".
      initial: {

        init: function() {
          var state = StateMachine.state = this;
          var btn = $(Settings.bind_to);
          btn.one('click.edithuddle', function(e) {
            e.preventDefault();
            $(e.target).blur();
            state.next(e);
          });
        },

        next: function(e) {
          // Set btn to be the outermost container
          var btn = $(e.target).closest(Settings.bind_to);
          StateMachine.vars.btn = btn;
          StateMachine.vars.postKey = btn.attr('data-postkey');
          StateMachine.vars.postTitle = btn.attr('data-posttitle');
          StateMachine.vars.postUrl = btn.attr('data-posturl');
          StateMachine._states.clicked.init(btn);
        },

        toString: function() { return "initial" }

      },

      // In `clicked`, the user has clicked the button so we activate it. If the user has already
      // selected text, we skip to `highlighted`; otherwise, we bind the transition function `next`
      // to the text selection event.
      clicked: {

        init: function(btn) {
          var state = StateMachine.state = this;
          // Activate the button
          btn = StateMachine.vars.btn;
          btn.addClass('edithuddle-button');
          // Check if user selected text before clicking the button
          // var selection = window.getSelection();
          var selection = StateMachine.vars.submission && 
            StateMachine.vars.submission.selection || '';
          // StateMachine.vars.selection = selection;
          // If so, show the report bubble
          if (selection.toString() != '') {
            StateMachine._states.highlighted.init();
          // Else, show the help bubble
          } else {
            UI.hideBubble(UI.bubbles.report);
            UI.showHelpBubble(btn);
          }
          // Enter the next state if the user selects text
          $(document).on('textselect.edithuddle', function() {
            if (StateMachine.vars.submission.selection != '')
              state.next();
          });
          // Enter the previous state if the user clicks the button
          btn.one('click.edithuddle', function(e) {
            e.preventDefault();
            $(e.target).blur();
            state.previous();
          });
        },

        previous: function() {
          // Hide bubbles
          UI.hideBubble(UI.bubbles.help);
          UI.hideBubble(UI.bubbles.report);
          // Deactivate event listeners
          StateMachine.vars.btn.off('click.edithuddle');
          $(document).off('textselect.edithuddle');
          // Reset the button
          StateMachine.vars.btn.removeClass('btn-warning');
          // StateMachine.vars.btn = undefined;
          // Goto initial state
          StateMachine._states.initial.init();
        },

        next: function(e) {
          // Hide bubbles
          UI.hideBubble(UI.bubbles.help);
          // Goto highlighted state
          StateMachine._states.highlighted.init(e);
        },

        toString: function() { return "clicked" }

      },

      // In `highlighted`, the user has highlighted text, so we show the report bubble.
      highlighted: {

        init: function(e) {
          var state = StateMachine.state = this;
          UI.bubbles.report.rpc.resetForms();
          // Show the report bubble where the user selected text
          UI.showReportBubble(StateMachine.vars.selectionEvent);
          // Enter the previous state if the user clicks out
          $(document).on('textselect.edithuddle', function() {
            if (StateMachine.vars.submission.selection == '')
              state.previous();
          });
        },

        previous: function() {
          // Hide report bubble
          UI.hideBubble(UI.bubbles.report);
          // Deactivate event listeners
          StateMachine.vars.btn.off('click.edithuddle');
          $(document).off('textselect.edithuddle');
          // Reset button
          StateMachine.vars.btn.removeClass('btn-warning');
          // StateMachine.vars.btn = undefined;
          // Goto initial state
          StateMachine._states.initial.init();
        },

        next: function(args) {
          StateMachine.vars.submission.category = args.category;
          StateMachine.vars.submission.suggestion = args.suggestion;
          RPC.rpc.postData(
            '/plugin/api/submission' + Utilities.makeQueryString({
              blog: Settings.blogKey,
              key: StateMachine.vars.postKey
            }),
            { container: StateMachine.vars.container,
              submission: StateMachine.vars.submission }
          );
          // Hide report bubble
          var bubble = UI.bubbles.report;
          UI.hideBubble(bubble);
          // Deactivate event listeners
          StateMachine.vars.btn.off('click.edithuddle');
          $(document).off('textselect.edithuddle');
          // Reset button
          StateMachine.vars.btn.removeClass('btn-warning');
          // Where to display the thanks bubble
          var x = $(bubble.node).position().left,
              y = $(bubble.node).position().top;
          // Goto submitted state
          StateMachine._states.submitted.init(x, y);
        },

        toString: function() { return "highlighted" }

      },

      // In `submitted`, the user has submitted a report, so we show a "Thank You" message.
      submitted: {

        init: function(x, y) {
          var state = StateMachine.state = this;
          // Show thanks bubble
          UI.showThanksBubble(x, y);
          // Set a delay on hiding thanks bubble
          UI.hideBubble(UI.bubbles.thanks, 1000);
          // Goto initial state
          StateMachine._states.initial.init();
        },

        toString: function() { return "submitted" }

      }

    }

  };

  // Set our first state.
  with (StateMachine) { state = _states.setup; }

  // plugin.Text
  // -----------
  
  // Our plugin relies heavily on manipulating text nodes. `Text` provides two integral functions,
  // (as well as some other utility functions) namely:
  //
  //     * `getTextNodesContaining` for finding (and splitting, when necessary) text nodes
  //       containing a given string, and
  //
  //     * `wrapTextNode` for wrapping a text node in a span with a given class.
  //
  // NOTE: These two functions provide the basis for our upcoming Heat Map functionality.
  var Text = plugin.Text = {

    // HACK: Convert predefined entity references and numeric character references to JavaScript's
    // Unicode representation.
    htmlEntityDecode: function(s) {
      var e = document.createElement('div');
      e.innerHTML = s;
      return e.childNodes[0].nodeValue;
    },

    // Replace a node `a` with `b` (returns the replaced node on success; otherwise NULL).
    replaceNode: function(a, b) {
      var parentNode = a.parentNode;
      return parentNode.replaceChild(b, a);
    },

    // Splits a given text node at index `0 >= i < textNode.nodeValue.length`, returning an object
    // containing the left and right text nodes.
    splitTextNode: function(textNode, i) {
      var str = textNode.nodeValue,
          leftText = str.slice(0, i),
          rightText = str.slice(i),
          parentNode = textNode.parentNode;
      var leftNode = document.createTextNode(leftText),
          rightNode = document.createTextNode(rightText);
      // NOTE: Before we tried to `insertBefore` the left node, then replace the `textNode` with
      // the right node (rather than the three step solution below), but this was glitchy.
      leftNode = parentNode.insertBefore(leftNode, textNode);
      rightNode = parentNode.insertBefore(rightNode, textNode);
      parentNode.removeChild(textNode);
      return {left: leftNode, right: rightNode}
    },

    // Search the document for `str`, returning a list of text nodes if the string is found;
    // otherwise, `undefined`.
    // NOTE: This method splits existing text nodes in order to return a list of text nodes
    // containing exactly `str`.
    //
    //     strPair = { str: String, offset: Integer }
    //
    getTextNodesContaining: function(str, containerStr) {
      var _containers = $('*').map(function(i, e) {
        var text = e.innerText || e.textContent;
        return text == containerStr ? e : undefined;
      });
      if (!_containers) return;
      var _container = _containers.last()[0];
      if (!_container) return;
      // Get the node that contains `str`.
      var containers = $(_container).map(function(i, e) {
        var text = e.innerText || e.textContent;
        var offset = text.search(str);
        // if (offset == -1) return undefined;
        return offset != -1 ? {
          node: e,
          offset: offset
        } : undefined;
      });
      if (!containers) return;
      var container = containers.last()[0];
      // Return `undefined` if we didn't find a match.
      if (!container) return;
      // Otherwise, get the text nodes within the containing node.
      var ts = this.getTextNodesIn(container.node),
          strLen = str.length, nodes = [], len = 0, i;
      // Go to the first text node within the containing node that contains `str`, according to
      // the offset stored in `container.offset`.
      for (i = 0; i < ts.length; i++) {
        var tLen = ts[i].nodeValue.length;
        len += tLen;
        if (len > container.offset) {
          // We consume `len - container.offset` characters of our search string, `str`.
          var acc = len - container.offset;
          var startOffset = tLen - acc;
          var split = this.splitTextNode(ts[i], startOffset);
          strLen -= acc;
          // The following handles the case where the entire `str` is contained within the node.
          if (strLen <= 0) {
            var split2 = this.splitTextNode(split.right, str.length);
            nodes.push(split2.left);
          } else {
            nodes.push(split.right);
          }
          break;
        }
      }
      // Walk the sibling text nodes.
      for (i += 1; i < ts.length; i++) {
        var tLen = ts[i].nodeValue.length;
        strLen -= tLen;
        if (strLen > 0) {
          nodes.push(ts[i]);
        } else {
          var endOffset = tLen + strLen;
          var split = this.splitTextNode(ts[i], endOffset);
          nodes.push(split.left);
          break;
        }
      }
      return nodes;
    },

    // For a given `node`, return a list of all text nodes within `node`. Optionally include
    // text nodes containing only whitespace.
    // SEE: http://stackoverflow.com/a/4399718/586970
    getTextNodesIn: function(node, includeWhitespaceNodes) {
      var textNodes = [], whitespace = /^\s*$/;
      function getTextNodes(node) {
        if (node.nodeType == 3) {
          if (includeWhitespaceNodes || !whitespace.test(node.nodeValue))
            textNodes.push(node);
        } else {
          for (var i = 0, len = node.childNodes.length; i < len; ++i)
            getTextNodes(node.childNodes[i]);
        }
      }
      getTextNodes(node);
      return textNodes;
    },

    // This function wraps a node in a span with a given class.
    wrapTextNode: function(textNode, className) {
      if (typeof className == 'undefined') className = 'heatmap';
      var span = document.createElement('span');
      if (className) {
        if (typeof className == 'string') {
          $(span).addClass(className);
        } else if (typeof className.length == 'number') {
          for (var i = 0; i < className.length; i++)
            $(span).addClass(className[i]);
        }
      }
      if (span.innerText)
        span.innerText = textNode.nodeValue;
      else
        span.textContent = textNode.nodeValue;
      this.replaceNode(textNode, span);
    },

    // This version of `wrapTextNode` works on lists of nodes.
    wrapTextNodes: function(textNodes, className) {
      if (typeof textNodes == 'undefined') return;
      for (var i = 0; i < textNodes.length; i++)
        this.wrapTextNode(textNodes[i], className);
    }

    // Calculate the Levenshtein distance between two sequences.
    // SEE: https://github.com/NYTimes/Emphasis
    //      http://en.wikipedia.org/wiki/Levenshtein_distance
    /*levenshteinDistance: function(a, b) {
      var m = a.length,
          n = b.length,
          r = [],
          c, o, i, j;
      r[0] = [];
      if (m < n) { c = a; a = b; b = c; o = m; m = n; n = 0; }
      for (var c = 0; c < n+1; c++) { r[0][c] = c; }
      for (var i = 1; i < m+1; i++) {
        r[i] = [];
        r[i][0] = i;
        for (var j = 1; j < n+1; j++) {
          r[i][j] = this.min3(
            r[i-1][j] + 1,
            r[i][j-1] + 1,
            r[i-1][j-1] + ((a.charAt(i-1) === b.charAt(j-1)) ? 0 : 1)
          )
        }
      }
      return r[m][n];
    },

    // Return the minimum of three values.
    min3: function(x, y, z) {
      if (x < y && x < z) { return x; }
      if (y < x && y < z) { return y; }
      return z;
    }*/

  };

  // plugin.HeatMap
  // --------------
  
  var HeatMap = plugin.HeatMap = {

    // Internal store of Heat Maps, keyed by post key (/[a-zA-Z0-9]+/), specified as follows:
    //
    //     Post key: {
    //       submissions: Array of submissions, where a submission is specified as
    //         { id: Integer, selection: String, category: String },
    //       visible: Boolean,
    //       lastID: Integer. }
    //
    _heatmaps: {},

    // Internal method for loading the Heat Map for a given post.
    _load: function(postKey, containers, refresh) {
      for (var j = 0; j < containers.length; j++) {
        with (containers[j]) {
          if (submissions.length == 0) return;
          var lastID = -1;
          for (var i = 0; i < submissions.length; i++) {
            // Record the greatest (i.e. most recent) Submission ID.
            lastID = Math.max(lastID, submissions[i].id);
            // Wrap nodes.
            Text.wrapTextNodes(Text.getTextNodesContaining(submissions[i].selection, text),
              'edithuddle-post-'+postKey);
          }
          if (refresh) {
            this._heatmaps[postKey].submissions = this._heatmaps[postKey].submissions.concat(
              submissions);
            if (lastID != -1)
              this._heatmaps[postKey].lastID = lastID;
          } else {
            this._heatmaps[postKey] = {
              submissions: submissions,
              visible: true,
              lastID: lastID
            };
          }
          if (this._heatmaps[postKey].visible)
            this._show(postKey);
        }
      }
    },

    load: function(postKey) {
      RPC.rpc.getSubmissions(Settings.blogKey, postKey);
    },

    // Toggles the visibility of the Heat Map for a given post (by `postKey`); returns a Boolean
    // indicating whether the Heat Map is visible.
    toggle: function() {
      var postKey = StateMachine.vars.postKey;
      if (typeof this._heatmaps[postKey] == 'undefined') {
        this.load(postKey);
        return true;
      } else if (this._heatmaps[postKey].visible) {
        // Hide `<span>` elements.
        this._hide(postKey);
        return this._heatmaps[postKey].visible = false;
      } else {
        // Show `<span>` elements.
        this._show(postKey);
        return this._heatmaps[postKey].visible = true;
      }
    },

    // Refresh the heatmap for a given post (by `postKey`).
    refresh: function(postKey) {
      UI.bubbles.thanks.rpc.getSubmissions(Settings.blogKey, postKey,
        this._heatmaps[postKey].lastID + 1);
    },

    // Internal method for "showing" the Heat Map. This works by setting the style attribute for
    // each 
    _show: function(postKey) {
      $('.edithuddle-post-'+postKey).css('background', 'rgba(255,0,0,0.25)');
    },

    _hide: function(postKey) {
      $('.edithuddle-post-'+postKey).css('background', '');
    }

  };

  // Go!
  // ---

  DependencyLoader.load(plugin.dependencies);

}).call(this);
