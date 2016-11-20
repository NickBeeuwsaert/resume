(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (factory());
}(this, (function () { 'use strict';

/** Virtual DOM Node */
function VNode(nodeName, attributes, children) {
	/** @type {string|function} */
	this.nodeName = nodeName;

	/** @type {object<string>|undefined} */
	this.attributes = attributes;

	/** @type {array<VNode>|undefined} */
	this.children = children;

	/** Reference to the given key. */
	this.key = attributes && attributes.key;
}

/** Global options
 *	@public
 *	@namespace options {Object}
 */
var options = {

	/** If `true`, `prop` changes trigger synchronous component updates.
	 *	@name syncComponentUpdates
	 *	@type Boolean
	 *	@default true
	 */
	//syncComponentUpdates: true,

	/** Processes all created VNodes.
	 *	@param {VNode} vnode	A newly-created VNode to normalize/process
	 */
	//vnode(vnode) { }

	/** Hook invoked after a component is mounted. */
	// afterMount(component) { }

	/** Hook invoked after the DOM is updated with a component's latest render. */
	// afterUpdate(component) { }

	/** Hook invoked immediately before a component is unmounted. */
	// beforeUnmount(component) { }
};

var stack = [];


/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 *  @example
 *  /** @jsx h *\/
 *  import { render, h } from 'preact';
 *  render(<span>foo</span>, document.body);
 */
function h(nodeName, attributes) {
	var arguments$1 = arguments;

	var children = [],
		lastSimple, child, simple, i;
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments$1[i]);
	}
	if (attributes && attributes.children) {
		if (!stack.length) { stack.push(attributes.children); }
		delete attributes.children;
	}
	while (stack.length) {
		if ((child = stack.pop()) instanceof Array) {
			for (i=child.length; i--; ) { stack.push(child[i]); }
		}
		else if (child!=null && child!==false) {
			if (typeof child=='number' || child===true) { child = String(child); }
			simple = typeof child=='string';
			if (simple && lastSimple) {
				children[children.length-1] += child;
			}
			else {
				children.push(child);
				lastSimple = simple;
			}
		}
	}

	var p = new VNode(nodeName, attributes || undefined, children);

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options.vnode) { options.vnode(p); }

	return p;
}

/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
function extend(obj, props) {
	if (props) {
		for (var i in props) { obj[i] = props[i]; }
	}
	return obj;
}


/** Fast clone. Note: does not filter out non-own properties.
 *	@see https://esbench.com/bench/56baa34f45df6895002e03b6
 */
function clone(obj) {
	return extend({}, obj);
}


/** Get a deep property value from the given object, expressed in dot-notation.
 *	@private
 */
function delve(obj, key) {
	for (var p=key.split('.'), i=0; i<p.length && obj; i++) {
		obj = obj[p[i]];
	}
	return obj;
}


/** @private is the given object a Function? */
function isFunction(obj) {
	return 'function'===typeof obj;
}


/** @private is the given object a String? */
function isString(obj) {
	return 'string'===typeof obj;
}


/** Convert a hashmap of CSS classes to a space-delimited className string
 *	@private
 */
function hashToClassName(c) {
	var str = '';
	for (var prop in c) {
		if (c[prop]) {
			if (str) { str += ' '; }
			str += prop;
		}
	}
	return str;
}


/** Just a memoized String#toLowerCase */
var lcCache = {};
var toLowerCase = function (s) { return lcCache[s] || (lcCache[s] = s.toLowerCase()); };


/** Call a function asynchronously, as soon as possible.
 *	@param {Function} callback
 */
var resolved = typeof Promise!=='undefined' && Promise.resolve();
var defer = resolved ? (function (f) { resolved.then(f); }) : setTimeout;

// render modes

var NO_RENDER = 0;
var SYNC_RENDER = 1;
var FORCE_RENDER = 2;
var ASYNC_RENDER = 3;

var EMPTY = {};

var ATTR_KEY = typeof Symbol!=='undefined' ? Symbol.for('preactattr') : '__preactattr_';

// DOM properties that should NOT have "px" added when numeric
var NON_DIMENSION_PROPS = {
	boxFlex:1, boxFlexGroup:1, columnCount:1, fillOpacity:1, flex:1, flexGrow:1,
	flexPositive:1, flexShrink:1, flexNegative:1, fontWeight:1, lineClamp:1, lineHeight:1,
	opacity:1, order:1, orphans:1, strokeOpacity:1, widows:1, zIndex:1, zoom:1
};

// DOM event types that do not bubble and should be attached via useCapture
var NON_BUBBLING_EVENTS = { blur:1, error:1, focus:1, load:1, resize:1, scroll:1 };

/** Create an Event handler function that sets a given state property.
 *	@param {Component} component	The component whose state should be updated
 *	@param {string} key				A dot-notated key path to update in the component's state
 *	@param {string} eventPath		A dot-notated key path to the value that should be retrieved from the Event or component
 *	@returns {function} linkedStateHandler
 *	@private
 */
function createLinkedState(component, key, eventPath) {
	var path = key.split('.');
	return function(e) {
		var t = e && e.target || this,
			state = {},
			obj = state,
			v = isString(eventPath) ? delve(e, eventPath) : t.nodeName ? (t.type.match(/^che|rad/) ? t.checked : t.value) : e,
			i = 0;
		for ( ; i<path.length-1; i++) {
			obj = obj[path[i]] || (obj[path[i]] = !i && component.state[path[i]] || {});
		}
		obj[path[i]] = v;
		component.setState(state);
	};
}

/** Managed queue of dirty components to be re-rendered */

// items/itemsOffline swap on each rerender() call (just a simple pool technique)
var items = [];

function enqueueRender(component) {
	if (!component._dirty && (component._dirty = true) && items.push(component)==1) {
		(options.debounceRendering || defer)(rerender);
	}
}


function rerender() {
	var p, list = items;
	items = [];
	while ( (p = list.pop()) ) {
		if (p._dirty) { renderComponent(p); }
	}
}

/** Check if a VNode is a reference to a stateless functional component.
 *	A function component is represented as a VNode whose `nodeName` property is a reference to a function.
 *	If that function is not a Component (ie, has no `.render()` method on a prototype), it is considered a stateless functional component.
 *	@param {VNode} vnode	A VNode
 *	@private
 */
function isFunctionalComponent(vnode) {
	var nodeName = vnode && vnode.nodeName;
	return nodeName && isFunction(nodeName) && !(nodeName.prototype && nodeName.prototype.render);
}



/** Construct a resultant VNode from a VNode referencing a stateless functional component.
 *	@param {VNode} vnode	A VNode with a `nodeName` property that is a reference to a function.
 *	@private
 */
function buildFunctionalComponent(vnode, context) {
	return vnode.nodeName(getNodeProps(vnode), context || EMPTY);
}

/** Check if two nodes are equivalent.
 *	@param {Element} node
 *	@param {VNode} vnode
 *	@private
 */
function isSameNodeType(node, vnode) {
	if (isString(vnode)) {
		return node instanceof Text;
	}
	if (isString(vnode.nodeName)) {
		return isNamedNode(node, vnode.nodeName);
	}
	if (isFunction(vnode.nodeName)) {
		return node._componentConstructor===vnode.nodeName || isFunctionalComponent(vnode);
	}
}


function isNamedNode(node, nodeName) {
	return node.normalizedNodeName===nodeName || toLowerCase(node.nodeName)===toLowerCase(nodeName);
}


/**
 * Reconstruct Component-style `props` from a VNode.
 * Ensures default/fallback values from `defaultProps`:
 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
 * @param {VNode} vnode
 * @returns {Object} props
 */
function getNodeProps(vnode) {
	var props = clone(vnode.attributes);
	props.children = vnode.children;

	var defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps) {
		for (var i in defaultProps) {
			if (props[i]===undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

/** Removes a given DOM Node from its parent. */
function removeNode(node) {
	var p = node.parentNode;
	if (p) { p.removeChild(node); }
}


/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *	If `value` is `null`, the attribute/handler will be removed.
 *	@param {Element} node	An element to mutate
 *	@param {string} name	The name/key to set, such as an event or attribute name
 *	@param {any} value		An attribute value, such as a function to be used as an event handler
 *	@param {any} previousValue	The last value that was set for this name/node pair
 *	@private
 */
function setAccessor(node, name, old, value, isSvg) {

	if (name==='className') { name = 'class'; }

	if (name==='class' && value && typeof value==='object') {
		value = hashToClassName(value);
	}

	if (name==='key') {
		// ignore
	}
	else if (name==='class' && !isSvg) {
		node.className = value || '';
	}
	else if (name==='style') {
		if (!value || isString(value) || isString(old)) {
			node.style.cssText = value || '';
		}
		if (value && typeof value==='object') {
			if (!isString(old)) {
				for (var i in old) { if (!(i in value)) { node.style[i] = ''; } }
			}
			for (var i$1 in value) {
				node.style[i$1] = typeof value[i$1]==='number' && !NON_DIMENSION_PROPS[i$1] ? (value[i$1]+'px') : value[i$1];
			}
		}
	}
	else if (name==='dangerouslySetInnerHTML') {
		if (value) { node.innerHTML = value.__html; }
	}
	else if (name[0]=='o' && name[1]=='n') {
		var l = node._listeners || (node._listeners = {});
		name = toLowerCase(name.substring(2));
		// @TODO: this might be worth it later, un-breaks focus/blur bubbling in IE9:
		// if (node.attachEvent) name = name=='focus'?'focusin':name=='blur'?'focusout':name;
		if (value) {
			if (!l[name]) { node.addEventListener(name, eventProxy, !!NON_BUBBLING_EVENTS[name]); }
		}
		else if (l[name]) {
			node.removeEventListener(name, eventProxy, !!NON_BUBBLING_EVENTS[name]);
		}
		l[name] = value;
	}
	else if (name!=='list' && name!=='type' && !isSvg && name in node) {
		setProperty(node, name, value==null ? '' : value);
		if (value==null || value===false) { node.removeAttribute(name); }
	}
	else {
		var ns = isSvg && name.match(/^xlink\:?(.+)/);
		if (value==null || value===false) {
			if (ns) { node.removeAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1])); }
			else { node.removeAttribute(name); }
		}
		else if (typeof value!=='object' && !isFunction(value)) {
			if (ns) { node.setAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1]), value); }
			else { node.setAttribute(name, value); }
		}
	}
}


/** Attempt to set a DOM property to the given value.
 *	IE & FF throw for certain property-value combinations.
 */
function setProperty(node, name, value) {
	try {
		node[name] = value;
	} catch (e) { }
}


/** Proxy an event to hooked event handlers
 *	@private
 */
function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}

/** DOM node pool, keyed on nodeName. */

var nodes = {};

function collectNode(node) {
	removeNode(node);

	if (node instanceof Element) {
		node._component = node._componentConstructor = null;

		var name = node.normalizedNodeName || toLowerCase(node.nodeName);
		(nodes[name] || (nodes[name] = [])).push(node);
	}
}


function createNode(nodeName, isSvg) {
	var name = toLowerCase(nodeName),
		node = nodes[name] && nodes[name].pop() || (isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName));
	node.normalizedNodeName = name;
	return node;
}

/** Diff recursion count, used to track the end of the diff cycle. */
var mounts = [];

/** Diff recursion count, used to track the end of the diff cycle. */
var diffLevel = 0;

var isSvgMode = false;


function flushMounts() {
	var c;
	while ((c=mounts.pop())) {
		if (options.afterMount) { options.afterMount(c); }
		if (c.componentDidMount) { c.componentDidMount(); }
	}
}


/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	if (!diffLevel++) { isSvgMode = parent instanceof SVGElement; }
	var ret = idiff(dom, vnode, context, mountAll);
	if (parent && ret.parentNode!==parent) { parent.appendChild(ret); }
	if (!--diffLevel && !componentRoot) { flushMounts(); }
	return ret;
}


function idiff(dom, vnode, context, mountAll) {
	var originalAttributes = vnode && vnode.attributes;

	while (isFunctionalComponent(vnode)) {
		vnode = buildFunctionalComponent(vnode, context);
	}

	if (vnode==null) { vnode = ''; }

	if (isString(vnode)) {
		if (dom) {
			if (dom instanceof Text && dom.parentNode) {
				if (dom.nodeValue!=vnode) {
					dom.nodeValue = vnode;
				}
				return dom;
			}
			recollectNodeTree(dom);
		}
		return document.createTextNode(vnode);
	}

	if (isFunction(vnode.nodeName)) {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}

	var out = dom,
		nodeName = vnode.nodeName,
		prevSvgMode = isSvgMode,
		vchildren = vnode.children;

	if (!isString(nodeName)) {
		nodeName = String(nodeName);
	}

	isSvgMode = nodeName==='svg' ? true : nodeName==='foreignObject' ? false : isSvgMode;

	if (!dom) {
		out = createNode(nodeName, isSvgMode);
	}
	else if (!isNamedNode(dom, nodeName)) {
		out = createNode(nodeName, isSvgMode);
		// move children into the replacement node
		while (dom.firstChild) { out.appendChild(dom.firstChild); }
		// reclaim element nodes
		recollectNodeTree(dom);
	}

	// fast-path for elements containing a single TextNode:
	if (vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && out.childNodes.length===1 && out.firstChild instanceof Text) {
		if (out.firstChild.nodeValue!=vchildren[0]) {
			out.firstChild.nodeValue = vchildren[0];
		}
	}
	else if (vchildren && vchildren.length || out.firstChild) {
		innerDiffNode(out, vchildren, context, mountAll);
	}

	var props = out[ATTR_KEY];
	if (!props) {
		out[ATTR_KEY] = props = {};
		for (var a=out.attributes, i=a.length; i--; ) { props[a[i].name] = a[i].value; }
	}

	diffAttributes(out, vnode.attributes, props);

	if (originalAttributes && typeof originalAttributes.ref==='function') {
		(props.ref = originalAttributes.ref)(out);
	}

	isSvgMode = prevSvgMode;

	return out;
}


/** Apply child and attribute changes between a VNode and a DOM Node to the DOM. */
function innerDiffNode(dom, vchildren, context, mountAll) {
	var originalChildren = dom.childNodes,
		children = [],
		keyed = {},
		keyedLen = 0,
		min = 0,
		len = originalChildren.length,
		childrenLen = 0,
		vlen = vchildren && vchildren.length,
		j, c, vchild, child;

	if (len) {
		for (var i=0; i<len; i++) {
			var child$1 = originalChildren[i],
				key = vlen ? ((c = child$1._component) ? c.__key : (c = child$1[ATTR_KEY]) ? c.key : null) : null;
			if (key || key===0) {
				keyedLen++;
				keyed[key] = child$1;
			}
			else {
				children[childrenLen++] = child$1;
			}
		}
	}

	if (vlen) {
		for (var i$1=0; i$1<vlen; i$1++) {
			vchild = vchildren[i$1];
			child = null;

			// if (isFunctionalComponent(vchild)) {
			// 	vchild = buildFunctionalComponent(vchild);
			// }

			// attempt to find a node based on key matching
			var key$1 = vchild.key;
			if (key$1!=null) {
				if (keyedLen && key$1 in keyed) {
					child = keyed[key$1];
					keyed[key$1] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			else if (!child && min<childrenLen) {
				for (j=min; j<childrenLen; j++) {
					c = children[j];
					if (c && isSameNodeType(c, vchild)) {
						child = c;
						children[j] = undefined;
						if (j===childrenLen-1) { childrenLen--; }
						if (j===min) { min++; }
						break;
					}
				}
				if (!child && min<childrenLen && isFunction(vchild.nodeName) && mountAll) {
					child = children[min];
					children[min++] = undefined;
				}
			}

			// morph the matched/found/created DOM child to match vchild (deep)
			child = idiff(child, vchild, context, mountAll);

			if (child && child!==dom && child!==originalChildren[i$1]) {
				dom.insertBefore(child, originalChildren[i$1] || null);
			}
		}
	}


	if (keyedLen) {
		for (var i$2 in keyed) { if (keyed[i$2]) { recollectNodeTree(keyed[i$2]); } }
	}

	// remove orphaned children
	if (min<childrenLen) {
		removeOrphanedChildren(children);
	}
}


/** Reclaim children that were unreferenced in the desired VTree */
function removeOrphanedChildren(children, unmountOnly) {
	for (var i=children.length; i--; ) {
		if (children[i]) {
			recollectNodeTree(children[i], unmountOnly);
		}
	}
}


/** Reclaim an entire tree of nodes, starting at the root. */
function recollectNodeTree(node, unmountOnly) {
	// @TODO: Need to make a call on whether Preact should remove nodes not created by itself.
	// Currently it *does* remove them. Discussion: https://github.com/developit/preact/issues/39
	//if (!node[ATTR_KEY]) return;

	var component = node._component;
	if (component) {
		unmountComponent(component, !unmountOnly);
	}
	else {
		if (node[ATTR_KEY] && node[ATTR_KEY].ref) { node[ATTR_KEY].ref(null); }

		if (!unmountOnly) {
			collectNode(node);
		}

		if (node.childNodes && node.childNodes.length) {
			removeOrphanedChildren(node.childNodes, unmountOnly);
		}
	}
}


/** Apply differences in attributes from a VNode to the given DOM Node. */
function diffAttributes(dom, attrs, old) {
	for (var name in old) {
		if (!(attrs && name in attrs) && old[name]!=null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// new & updated
	if (attrs) {
		for (var name$1 in attrs) {
			if (name$1!=='children' && name$1!=='innerHTML' && (!(name$1 in old) || attrs[name$1]!==(name$1==='value' || name$1==='checked' ? dom[name$1] : old[name$1]))) {
				setAccessor(dom, name$1, old[name$1], old[name$1] = attrs[name$1], isSvgMode);
			}
		}
	}
}

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
 *	@private
 */
var components = {};


function collectComponent(component) {
	var name = component.constructor.name,
		list = components[name];
	if (list) { list.push(component); }
	else { components[name] = [component]; }
}


function createComponent(Ctor, props, context) {
	var inst = new Ctor(props, context),
		list = components[Ctor.name];
	Component.call(inst, props, context);
	if (list) {
		for (var i=list.length; i--; ) {
			if (list[i].constructor===Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}

/** Set a component's `props` (generally derived from JSX attributes).
 *	@param {Object} props
 *	@param {Object} [opts]
 *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
 *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
 */
function setComponentProps(component, props, opts, context, mountAll) {
	if (component._disable) { return; }
	component._disable = true;

	if ((component.__ref = props.ref)) { delete props.ref; }
	if ((component.__key = props.key)) { delete props.key; }

	if (!component.base || mountAll) {
		if (component.componentWillMount) { component.componentWillMount(); }
	}
	else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}

	if (context && context!==component.context) {
		if (!component.prevContext) { component.prevContext = component.context; }
		component.context = context;
	}

	if (!component.prevProps) { component.prevProps = component.props; }
	component.props = props;

	component._disable = false;

	if (opts!==NO_RENDER) {
		if (opts===SYNC_RENDER || options.syncComponentUpdates!==false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		}
		else {
			enqueueRender(component);
		}
	}

	if (component.__ref) { component.__ref(component); }
}



/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
 *	@param {Component} component
 *	@param {Object} [opts]
 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
 *	@private
 */
function renderComponent(component, opts, mountAll, isChild) {
	if (component._disable) { return; }

	var skip, rendered,
		props = component.props,
		state = component.state,
		context = component.context,
		previousProps = component.prevProps || props,
		previousState = component.prevState || state,
		previousContext = component.prevContext || context,
		isUpdate = component.base,
		nextBase = component.nextBase,
		initialBase = isUpdate || nextBase,
		initialChildComponent = component._component,
		inst, cbase;

	// if updating
	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (opts!==FORCE_RENDER
			&& component.shouldComponentUpdate
			&& component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		}
		else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		if (component.render) { rendered = component.render(props, state, context); }

		// context to pass to the child, can be updated via (grand-)parent component
		if (component.getChildContext) {
			context = extend(clone(context), component.getChildContext());
		}

		while (isFunctionalComponent(rendered)) {
			rendered = buildFunctionalComponent(rendered, context);
		}

		var childComponent = rendered && rendered.nodeName,
			toUnmount, base;

		if (isFunction(childComponent)) {
			// set up high order component link


			inst = initialChildComponent;
			var childProps = getNodeProps(rendered);

			if (inst && inst.constructor===childComponent) {
				setComponentProps(inst, childProps, SYNC_RENDER, context);
			}
			else {
				toUnmount = inst;

				inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				component._component = inst;
				setComponentProps(inst, childProps, NO_RENDER, context);
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		}
		else {
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts===SYNC_RENDER) {
				if (cbase) { cbase._component = null; }
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base!==initialBase && inst!==initialChildComponent) {
			var baseParent = initialBase.parentNode;
			if (baseParent && base!==baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount, base!==initialBase);
		}

		component.base = base;
		if (base && !isChild) {
			var componentRef = component,
				t = component;
			while ((t=t._parentComponent)) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.unshift(component);
	}
	else if (!skip) {
		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options.afterUpdate) { options.afterUpdate(component); }
	}

	var cb = component._renderCallbacks, fn;
	if (cb) { while ( (fn = cb.pop()) ) { fn.call(component); } }

	if (!diffLevel && !isChild) { flushMounts(); }
}



/** Apply the Component referenced by a VNode to the DOM.
 *	@param {Element} dom	The DOM node to mutate
 *	@param {VNode} vnode	A Component-referencing VNode
 *	@returns {Element} dom	The created/mutated element
 *	@private
 */
function buildComponentFromVNode(dom, vnode, context, mountAll) {
	var c = dom && dom._component,
		oldDom = dom,
		isDirectOwner = c && dom._componentConstructor===vnode.nodeName,
		isOwner = isDirectOwner,
		props = getNodeProps(vnode);
	while (c && !isOwner && (c=c._parentComponent)) {
		isOwner = c.constructor===vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	}
	else {
		if (c && !isDirectOwner) {
			unmountComponent(c, true);
			dom = oldDom = null;
		}

		c = createComponent(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L241:
			oldDom = null;
		}
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		if (oldDom && dom!==oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom);
		}
	}

	return dom;
}



/** Remove a component from the DOM and recycle it.
 *	@param {Element} dom			A DOM node from which to unmount the given Component
 *	@param {Component} component	The Component instance to unmount
 *	@private
 */
function unmountComponent(component, remove) {
	if (options.beforeUnmount) { options.beforeUnmount(component); }

	// console.log(`${remove?'Removing':'Unmounting'} component: ${component.constructor.name}`);
	var base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) { component.componentWillUnmount(); }

	component.base = null;

	// recursively tear down & recollect high-order component children:
	var inner = component._component;
	if (inner) {
		unmountComponent(inner, remove);
	}
	else if (base) {
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) { base[ATTR_KEY].ref(null); }

		component.nextBase = base;

		if (remove) {
			removeNode(base);
			collectComponent(component);
		}
		removeOrphanedChildren(base.childNodes, !remove);
	}

	if (component.__ref) { component.__ref(null); }
	if (component.componentDidUnmount) { component.componentDidUnmount(); }
}

/** Base Component class, for he ES6 Class method of creating Components
 *	@public
 *
 *	@example
 *	class MyFoo extends Component {
 *		render(props, state) {
 *			return <div />;
 *		}
 *	}
 */
function Component(props, context) {
	/** @private */
	this._dirty = true;
	// /** @public */
	// this._disableRendering = false;
	// /** @public */
	// this.prevState = this.prevProps = this.prevContext = this.base = this.nextBase = this._parentComponent = this._component = this.__ref = this.__key = this._linkedStates = this._renderCallbacks = null;
	/** @public */
	this.context = context;
	/** @type {object} */
	this.props = props;
	/** @type {object} */
	if (!this.state) { this.state = {}; }
}


extend(Component.prototype, {

	/** Returns a `boolean` value indicating if the component should re-render when receiving the given `props` and `state`.
	 *	@param {object} nextProps
	 *	@param {object} nextState
	 *	@param {object} nextContext
	 *	@returns {Boolean} should the component re-render
	 *	@name shouldComponentUpdate
	 *	@function
	 */
	// shouldComponentUpdate() {
	// 	return true;
	// },


	/** Returns a function that sets a state property when called.
	 *	Calling linkState() repeatedly with the same arguments returns a cached link function.
	 *
	 *	Provides some built-in special cases:
	 *		- Checkboxes and radio buttons link their boolean `checked` value
	 *		- Inputs automatically link their `value` property
	 *		- Event paths fall back to any associated Component if not found on an element
	 *		- If linked value is a function, will invoke it and use the result
	 *
	 *	@param {string} key				The path to set - can be a dot-notated deep key
	 *	@param {string} [eventPath]		If set, attempts to find the new state value at a given dot-notated path within the object passed to the linkedState setter.
	 *	@returns {function} linkStateSetter(e)
	 *
	 *	@example Update a "text" state value when an input changes:
	 *		<input onChange={ this.linkState('text') } />
	 *
	 *	@example Set a deep state value on click
	 *		<button onClick={ this.linkState('touch.coords', 'touches.0') }>Tap</button
	 */
	linkState: function linkState(key, eventPath) {
		var c = this._linkedStates || (this._linkedStates = {});
		return c[key+eventPath] || (c[key+eventPath] = createLinkedState(this, key, eventPath));
	},


	/** Update component state by copying properties from `state` to `this.state`.
	 *	@param {object} state		A hash of state properties to update with new values
	 */
	setState: function setState(state, callback) {
		var s = this.state;
		if (!this.prevState) { this.prevState = clone(s); }
		extend(s, isFunction(state) ? state(s, this.props) : state);
		if (callback) { (this._renderCallbacks = (this._renderCallbacks || [])).push(callback); }
		enqueueRender(this);
	},


	/** Immediately perform a synchronous re-render of the component.
	 *	@private
	 */
	forceUpdate: function forceUpdate() {
		renderComponent(this, FORCE_RENDER);
	},


	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
	 *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
	 *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
	 *	@param {object} state		The component's current state
	 *	@param {object} context		Context object (if a parent component has provided context)
	 *	@returns VNode
	 */
	render: function render() {}

});

/** Render JSX into a `parent` Element.
 *	@param {VNode} vnode		A (JSX) VNode to render
 *	@param {Element} parent		DOM element to render into
 *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge`
 *	@public
 *
 *	@example
 *	// render a div into <body>:
 *	render(<div id="hello">hello!</div>, document.body);
 *
 *	@example
 *	// render a "Thing" component into #foo:
 *	const Thing = ({ name }) => <span>{ name }</span>;
 *	render(<Thing name="one" />, document.querySelector('#foo'));
 */
function render$1(vnode, parent, merge) {
	return diff(merge, vnode, {}, false, parent);
}

function Section(ref) {
    var title = ref.title;
    var children = ref.children;

    return h( 'section', null,
        h( 'h1', null, title ),
        h( 'hr', null ),
        children
    );
}

function Header(ref) {
    var name = ref.name;
    var label = ref.label;
    var phone = ref.phone;
    var email = ref.email;
    var website = ref.website;
    var profiles = ref.profiles; if ( profiles === void 0 ) profiles = [];

    return h( 'header', { class: "resume-header" },
        h( 'div', null,
            h( 'h1', null, name ),
            h( 'h2', null, label )
        ),
        h( 'div', { class: "align-right" },
            h( 'ul', { class: "contact" },
                h( 'li', null, h( 'span', { class: 'icon icon-phone' }), h( 'a', { href: ("tel:" + phone) }, phone) ),
                h( 'li', null, h( 'span', { class: 'icon icon-email' }), h( 'a', { href: ("mailto:" + email) }, email) ),
                h( 'li', null, h( 'span', { class: 'icon icon-internet' }), h( 'a', { href: website }, website) ),
                profiles.map(function (profile) { return h( 'li', null,
                    h( 'span', { class: ("icon icon-" + (profile.network)) }),  
                    h( 'a', { href: profile.url }, profile.username)
                ); })
            )
        )
    );
}

var LOCALE = ['xml:lang', 'lang'].reduce(
    function (winner, contender) { return winner ? winner : document.documentElement.getAttribute(contender); },
    undefined
) || 'en-US';

function Time(ref) {
    var datetime = ref.datetime;
    var locale = ref.locale;
    var options$$1 = ref.options; if ( options$$1 === void 0 ) options$$1 = {};

    var date = new Date(datetime);
    return h( 'time', { datetime: datetime }, date.toLocaleString(locale, options$$1))
}

function Job(ref) {
    var company = ref.company;
    var position = ref.position;
    var start_date = ref.start_date;
    var end_date = ref.end_date;
    var summary = ref.summary;
    var highlights = ref.highlights;

    var dateOptions = {year: 'numeric', month: 'long', timeZone: 'UTC'};


    return h( 'article', null,
        h( 'div', { class: "article-header" },
            h( 'div', null,
                h( 'h3', null, position ),
                h( 'small', null, h( 'em', null, company ) )
            ),
            h( 'div', { class: "align-right" },
                h( 'h3', null,
                    h( Time, { datetime: start_date, locale: LOCALE, options: dateOptions }), " – ", h( Time, { datetime: end_date, locale: LOCALE, options: dateOptions })
                )
            )
        ),
        h( 'p', null, summary ),
        h( 'ul', { class: "job-highlights" },
            highlights.map(function (highlight) { return h( 'li', null, highlight ); })
        )
    );
}

function School(ref) {
    var institution = ref.institution;
    var location = ref.location;
    var start_date = ref.start_date;
    var end_date = ref.end_date;

    var dateOptions = {
        year: 'numeric',
        timeZone: 'UTC'
    };

    return h( 'article', null,
        h( 'div', { class: "article-header" },
            h( 'div', null,
                h( 'h3', null, institution ),
                h( 'small', null, h( 'em', null, location ) )
            ),
            h( 'div', { class: "align-right" },
                h( 'h3', null,
                    h( Time, { datetime: start_date, locale: LOCALE, options: dateOptions }), " – ", h( Time, { datetime: end_date, locale: LOCALE, options: dateOptions })
                )
            )
        )
    );
}

function Resume(ref) {
    var basic = ref.basic;
    var work = ref.work;
    var education = ref.education;

    return h( 'div', null,
        h( Header, basic),
        h( Section, { title: "Experience" },
            work.map(function (job) { return h( Job, job); })
        ),
        h( Section, { title: "Education" },
            education.map(function (school) { return h( School, school); })
        )
    );
}

var basic = {"name":"Nick Beeuwsaert","label":"Fullstack Developer","email":"john.doe@gmail.com","phone":"555-555-5555","website":"http://nick.beeuwsaert.me","profiles":[{"network":"github","username":"NickBeeuwsaert","url":"https://github.com/NickBeeuwsaert"}]};
var work = [{"company":"Group 3 Marketing","tech":["Ansible","Python","Flask","Pyramid","React","Babel","ES2015","Javascript","MySQL","SCSS","PostCSS","Javascript (ES2015)","SQLAlchemy","Unit Testing","Git"],"position":"Fullstack Developer","start_date":"2015-07","end_date":"2016-09","summary":"Group 3 Marketing is a marketing agency that specializes in connecting it's clients to customers using data analytics.","highlights":["Lead development on a Python Flask microservice to import a users contacts into a form, which saved the company $500 a month, on average","Implemented version control using git for current and future projects","Used build tools such as Grunt/Gulp/Webpack to bundle frontend dependencies","Transpile frontend javascript from ES2015 to ES5 using Babel, which helped cut development time in half","Used SCSS and Bootstrap to upgrade look and feel of legacy sites"]},{"company":"Promotion Management Center","position":"Fullstack Developer","start_date":"2013-09","end_date":"2015-06","tech":["CakePHP","PHP","MySQL","Amazon Web Services","Git","MongoDB"],"summary":"PMCI provides fulfillment services and rebates to it's clients.","highlights":["Maintain legacy PHP applications","Rapidly develop new sites using CakePHP","Wrote applications that interacted with both MongoDB and MySQL","Develop flexible microservice for use on rebate forms","Develop nightly import scripts in Python"]}];
var education = [{"institution":"Princeton High School","start_date":"2009","end_date":"2013","location":"Princeton, MN"}];
var resume = {
	basic: basic,
	work: work,
	education: education
};

render$1(h( Resume, resume), document.getElementById("resume-container"));

})));
