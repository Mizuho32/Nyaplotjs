define([
    "underscore",
    "core",
    "utils/uuid",
    "utils/args2arr",
    "simple/glyphs/_init"
], function(_, core, uuid, args2arr, generate_glyphs){
    return function(S){
        _.extend(Plot.prototype, generate_glyphs(S));
        
        /**
         @example
         var p = new Plot({width: 500, height: 500});
         p.scatter(xarr, yarr, {color: "#000"});
         p.line(xarr2, yarr2)
         p.render("#vis");
         */
        function Plot(_options){
            var options = _.extend({
                width: 400,
                height: 400
            }, _options);
            
            var stage = new S.Stage({
            });

            var wh = {
                width: options.width,
                height: options.height
            };
            
            var xscale = new S.Scale({
                type: "linear",
                domain: [],
                range: [0, wh.width]
            });
            
            var yscale = new S.Scale({
                type: "linear",
                domain: [],
                range: [wh.height, 0]
            });

            var xaxis = new S.Axis({
                scale: xscale,
                height: 35
            });

            var yaxis = new S.Axis({
                scale: yscale,
                orient: "left",
                width: 70
            });

            var grid = new S.Grid(_.extend({
                xscale: xscale,
                yscale: yscale
            }, wh));
            
            var position = new S.Position2d({
                x: xscale,
                y: yscale
            });

            var legend = new S.Legend({
                margin: {top: 13, bottom: 0, left: 0, right: 0},
                updates: [],
                colors: [],
                names: []
            });

            this.uuid = uuid();
            this._data = [];
            this._glyphs = [];
            this._tooltips = [];
            this._dependencies = [];
            this.xdomain = null;
            this.ydomain = null;
            this.xarrs = [];
            this.yarrs = [];
            this.show_grid = true;
            this.show_legend = false;
            this.reset_xdomain = true;
            this.reset_ydomian = true;
            this.interactive = true;
            this.inner_legend = false;
            this.with_widget = false;
            this.with_tooltip = false;
            this.y_axis_w = 70;
            
            this.props = {
                _stage: stage,
                _position: position,
                _xscale: xscale,
                _yscale: yscale,
                _xaxis: xaxis,
                _yaxis: yaxis,
                _xlabel: null,
                _ylabel: null,
                _title: null,
                _widget: null,
                _legend: legend,
                _grid: grid,
                _background: new S.Background({
                    width: wh.width+4,
                    height: wh.height+4,
                    dx: -2,
                    dy: -2
                }),
                _context: new S.Context(wh),
                _wheelzoom: new S.Wheelzoom(_.extend({
                    xscale: xscale,
                    yscale: yscale,
                    updates: [xaxis, yaxis, grid]
                }, wh)),
                _tooltip: new S.Ytooltip(_.extend({
                    targets: [],
                    target_types: [],
                    xlabels: [],
                    ylabels: [],
                    positions: []
                }, wh))
            };
        }

        Plot.prototype.render = function(text){
            return core.parse(text, this.create_models());
        };

        Plot.prototype.to_png = function(text){
            return core.to_png(text, this.create_models());
        };

        Plot.prototype.create_models = function(){
            var others = [];
            
            /// construct layout tree
            var layout = (function(){
                function newNode(_uuid, _children){
                    return {
                        uuid: _uuid,
                        children: _children
                    };
                }

                var context = (function(){
                    return newNode(this.props._context.uuid, _.map(this._glyphs, function(glyph){
                        return newNode(glyph.uuid, []);
                    }));
                }.bind(this))();

                if(this.show_legend && this.inner_legend){
                    context.children.push(newNode(this.props._legend.uuid, []));
                }

                var simple2node = function(simple){
                    if(simple.is_simple)return newNode(simple.uuid, []);
                    else return simple;
                };

                var row = function(right, left, options){
                    options = _.extend({}, options);
                    var r = new S.Row(options);
                    others.push(r);
                    return {
                        uuid: r.uuid,
                        children: [simple2node(right), simple2node(left)]
                    };
                };

                var column = function(top, bottom, options){
                    options = _.extend({}, options);
                    var c = new S.Column(options);
                    others.push(c);
                    return {
                        uuid: c.uuid,
                        children: [simple2node(top), simple2node(bottom)]
                    };
                };

                var html_row = function(right, left, options){
                    options = _.extend({}, options);
                    var r = new S.Html_row(options);
                    others.push(r);
                    return {
                        uuid: r.uuid,
                        children: [simple2node(right), simple2node(left)]
                    };
                };
                
                var current = newNode(this.props._background.uuid, (function(){
                    if(this.show_grid==true)
                        return [newNode(this.props._grid.uuid, [context])];
                    else
                        return [context];
                }.bind(this))());

                if(this.with_tooltip)
                    current = newNode(this.props._tooltip.uuid, [current]);

                if(this.interactive)
                    current = newNode(this.props._wheelzoom.uuid, [current]);

                current = column(this.props._yaxis,
                                 row(current, this.props._xaxis),{
                                     margin: {top: 15, bottom: 5, left: 15, right: 15}
                                 });

                if(!_.isNull(this.props._xlabel))
                    current = row(current, this.props._xlabel);

                if(!_.isNull(this.props._ylabel))
                    current = column(this.props._ylabel, current);

                if(this.show_legend && !this.inner_legend){
                    current = column(current, this.props._legend);
                }
                
                if(!_.isNull(this.props._title))
                    current = row(this.props._title, current);
                
                current = newNode(this.props._stage.uuid, [current]);
                current.parser_type = "svg";

                if(this.with_widget == true){
                    this.props._widget = new S.Widget({svg: this.props._stage});
                    current = html_row(this.props._widget, current);
                }
                
                return current;
            }.bind(this))();

            // calc range and data type
            this.decide_domain();
            this.props._xscale.props.domain = _.clone(this.xdomain);
            this.props._yscale.props.domain = _.clone(this.ydomain);
            if(this.reset_xdomain)this.xdomain = null;
            if(this.reset_ydomain)this.ydomain = null;
            
            var defs = (function(){
                var arr = _.select(
                    _.values(this.props)
                        .concat(others)
                        .concat(this._glyphs)
                        .concat(this._dependencies)
                        .concat(this._data), function(val){return !_.isNull(val);});
                
                return _.map(arr, function(l){
                    return l.to_json();
                });
            }.bind(this))();

            return {
                uuid: this.uuid,
                defs: defs,
                layout: layout
            };
        };

        Plot.prototype.title = function(text){
            var p = {
                dx: this.y_axis_w/2,
                text: text,
                font_size: 26,
                text_anchor: "start",
                xalign: "center",
                yalign: "center",
                margin: {top: 0, bottom: 20, left: 5, right: 5}
            };
            if(text.match(/\$\$(.+)\$\$/))
                this.props._title = new S.Mathlabel(p);
            else
                this.props._title = new S.Label(p);
        };

        Plot.prototype.xlabel = function(text){
            var p = {
                dx: this.y_axis_w/2,
                text: text,
                xalign: "center",
                dominant_baseline: "text-before-edge"
            };
            
            if(text.match(/\$\$(.+)\$\$/))
                this.props._xlabel = new S.Mathlabel(p);
            else
                this.props._xlabel = new S.Label(p);
        };

        Plot.prototype.with_grid = function(yn){
            if(yn){
                if(this.props._wheelzoom.props.updates.indexOf(this.props._grid)==-1)
                    this.props._wheelzoom.props.updates.push(this.props._grid);
                this.show_grid = true;
            }else{
                var pos = this.props._wheelzoom.props.updates.indexOf(this.props._grid);
                if(pos!=-1)
                    this.props._wheelzoom.props.updates.splice(pos, 1);
                this.show_grid = false;
            }
        };

        Plot.prototype.legend = function(yn){
            this.show_legend = yn;
        };

        Plot.prototype.ylabel = function(text){
            var p = {
                text: text,
                rotate: -90,
                xalign: "center",
                yalign: "center"
            };
            
            if(text.match(/\$\$(.+)\$\$/))
                this.props._ylabel = new S.Mathlabel(p);
            else
                this.props._ylabel = new S.Label(p);
        };

        Plot.prototype.xscale = function(type){
            this.props._xscale.props.type = type;
        };

        Plot.prototype.yscale = function(type){
            this.props._yscale.props.type = type;
        };

        return Plot;
    };
});
