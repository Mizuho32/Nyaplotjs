define([
    'underscore',
    'core',
    'layers/svg/axis',
    'layers/svg/background',
    'layers/svg/grid',
    'layers/svg/label',
    'layers/svg/math_label',
    'layers/svg/context',
    'layers/svg/stage2d',
    'layers/svg/column',
    'layers/svg/row',
    'layers/svg/legend',
    'layers/svg/wheel_zoom',
    'layers/svg/y_tooltip',
    //'layers/svg/brush_zoom',
], function(_, core){
    var args = [].slice.call(arguments, 2);

    return function(){
        _.each(args, function(arg){
            core.register_layer.apply(core, arg);
        });
    };
});
