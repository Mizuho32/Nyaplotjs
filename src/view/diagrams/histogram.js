define([
    'underscore',
    'node-uuid',
    'core/manager',
    'view/components/filter',
    'view/components/legend/simple_legend'
],function(_, uuid, Manager, Filter, SimpleLegend){
    function Histogram(parent, scales, df_id, _options){
        var options = {
            title: 'histogram',
            value: null,
            bin_num: 20,
            width: 0.9,
            color:'steelblue',
            stroke_color: 'black',
            stroke_width: 1,
            hover: true,
            tooltip:null
        };
        if(arguments.length>3)_.extend(options, _options);

        var df = Manager.getData(df_id);
        var model = parent.append("g");

        this.scales = scales;
        this.legends = [{label: options.title, color:options.color}];
        this.options = options;
        this.model = model;
        this.df = df;
        this.uuid = options.uuid;
        
        return this;
    }

    Histogram.prototype.update = function(){
        var column_value = this.df.columnWithFilters(this.uuid, this.options.value);
        var data = this.processData(column_value, this.options);

        var models = this.model.selectAll("rect").data(data);
        if(models[0][0]==undefined){
            models = models.enter()
                .append("rect")
                .attr("height", 0)
                .attr("y", this.scales.get(0, 0).y);
        }

        this.updateModels(models,  this.scales, this.options);
    };

    Histogram.prototype.processData = function(column, options){
        return d3.layout.histogram()
            .bins(this.scales.raw.x.ticks(options.bin_num))(column);
    };

    Histogram.prototype.updateModels = function(selector, scales, options){
        var onMouse = function(){
            d3.select(this).transition()
                .duration(200)
                .attr("fill", d3.rgb(options.color).darker(1));
            var id = d3.select(this).attr("id");
            options.tooltip.addToYAxis(id, this.__data__.y, 3);
            options.tooltip.update();
        };

        var outMouse = function(){
            d3.select(this).transition()
                .duration(200)
                .attr("fill", options.color);
            var id = d3.select(this).attr("id");
            options.tooltip.reset();
        };

        selector
            .attr("x",function(d){return scales.get(d.x, 0).x;})
            .attr("width", function(d){return scales.get(d.dx, 0).x - scales.get(0, 0).x;})
            .attr("fill", options.color)
            .attr("stroke", options.stroke_color)
            .attr("stroke-width", options.stroke_width)
            .transition().duration(200)
            .attr("y", function(d){return scales.get(0, d.y).y;})
            .attr("height", function(d){return scales.get(0, 0).y - scales.get(0, d.y).y;})
            .attr("id", uuid.v4());
        
        if(options.hover)selector
            .on("mouseover", onMouse)
            .on("mouseout", outMouse);
    };

    Histogram.prototype.getLegend = function(){
        return new SimpleLegend(this.legend_data);
    };

    Histogram.prototype.checkSelectedData = function(ranges){
        var label_value = this.options.value;
        var filter = function(row){
            var val = row[label_value];
            if(val > ranges.x[0] && val < ranges.x[1])return true;
            else return false;
        };
        this.df.addFilter(this.uuid, filter, ['self']);
        Manager.update();
    };

    return Histogram;
});
