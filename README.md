# gl-compute

## WebGL Compute Framework

An attempt at creating a compute framework on top of WebGL. Based on some [Stack.gl](stack.gl) modules. There are projects alike, but either they require indepth knowledge of OpenGL to base projects of, they are too inflexible or they are too tied with a specific usage ([webclgl](https://github.com/stormcolor/webclgl) / [webgl-matrix-demo](https://github.com/watmough/webgl-matrix-demo) / [three.js - gpgpu flocking](http://jabtunes.com/labs/3d/gpuflocking/webgl_gpgpu_flocking6.html)).

****

### Stage Setup Options

Stages must be fed to gl-compute in the order of computations, a render stage (if any) provided lastly.
The computation cycle will pass the results of one stage to the next according to it's name (see bellow).
The last computation stage will pass it's results back to the first stage automatically.
Because of this in the first cycle (loop) the last stage data will be empty.

```
var outputBuffer = { data: new Float32Array( compute.width * compute.height * 4 ), callback: function(){ console.log(this.data) } }
var options = {
	type			: Stage Type - 'COMPUTE' (for the actual computations) or
								   'RENDER' (can be ommited, optional for visualization purposes only)
	
	stageShape		: Stage Shape - These are the dimensions of this stages' output
					  Length = stageShape[0] * stageShape[1] * 4 (4 = number of components/colors per element)

	shaderSources	: Shader Sources - to use in this stage
					  (these are barebones, create them and don't worry about uniform declaration - check uniforms option bellow)

	uniforms		: Stage Inputs - Data input to be fed to gl-compute
	
		{ uniformName : { type: 'sampler2D', data: inputData, shape: shape, flip: boolean } }
		
					  These will be made into texture uniforms and fragment shader source will be generated and added correspondingly
					  Each named property here becomes the uniform name to be made available in the shader
					  GLSL naming conventions apply here
					  The code generation includes a header and comments for your reference (ie. Stage Name and generation/compilation loop)
					  Use your browser's shader editor to check the complete GLSL code being compiled

	draw			: Draw Flag - to activate/deactivate this stage on demand

	readOutput		: Read Output Flag - Most performance impact only activate if stage's intermediate results are required
	
	outputBuffer	: Reference to a destination for the data and definition of convenience callback whenever new data is ready
					  Should be able to reuse an existing object (ie. the same object wich provided the original data?)
}

Inititalise Stages - Provide options as an object, stages will be named here	
compute.stagePreInit( { nameOfStage1: stageOptions1, nameOfStage2: stageOptions2, nameOfStage3: stageOptions3, renderStage: stageRender } )
```

****
Disclaimer: this is an hobbyist approach, don't let my code bad practices deceive you. Not used to this package and modules managers from the point of the developer. I used npm to install and browserify to build modules into standalone versions. I am also keeping a custom modules.js which once parsed by browserify spits a file exposing all dependencies the project requires into a single file. Comments in code is me YELLING at myself not you. ;)

