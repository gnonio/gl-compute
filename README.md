# gl-compute

## WebGL Compute Framework

A compute framework on top of WebGL. Based on some [#stack.gl](http://www.stack.gl) modules. This framework will allow to create custom kernels for each stage of a algorithm intended to run in parallel on the GPU. Stages are defined given the need in a phase of a algorithm of the results of a previous phase. Additionally the full algorithm may then be looped over, providing the last phase results to the first according to your needs. The objective is to have a featured, easy to understand and use framework, following parallel processing conventions is not necessarily the aim of this project (though they may appear here and there). You may also have interest in existing projects that served as inspiration: [webclgl](https://github.com/stormcolor/webclgl) / [webgl-matrix-demo](https://github.com/watmough/webgl-matrix-demo) / [three.js - gpgpu flocking](http://jabtunes.com/labs/3d/gpuflocking/webgl_gpgpu_flocking6.html). Check also [webLas](https://github.com/waylonflinn/weblas) which is shaping up pretty good.

### [DEMO](http://www.euclidiana.pt/gnonio/gl-compute) - Offline

****

### Install

- `npm install gl-compute`

- `var glCompute = require('gl-compute')`
*as a module for your projects*

- `browserify node_modules/gl-compute/demo/js/index.js -o node_modules/gl-compute/demo/js/bundle.js`

*as a Demo to try out*

****

### Features

- Plug-in to any project: just tell gl-compute which object contains your data and it's location (objects' attribute)
- Multiple Data sources: provide a configurable amount of inputs to each phase of your algorithm
- Input data update: ability to set input data as dirty
- Automatic uniform glsl code generation: link inputs via gl-compute config and code the kernels not bothering with uniform declaration (reduces code management)
- Configurable outputs: similarly to inputs plug-in interface
- Update inplace: output data may be directly written to source input object
- Output callback: configure your custom function once output data has been written

****

### Todo

- Improve default Render stage, show all inputs + outputs, dynamically accommodate multiple shapes
- Improve internal interface, setting inputs / outputs, integrate demo stageSetup() function, variable name consistency
- Improve usage workflow, still too cumbersome (between testing a shader, verifying available inputs and their naming, and glsl debugging)
- Provide a more thorough guide on how to use
- Provide some canned shaders for common pre and post processing tasks (ie. input data 1 component > output data 4 components > output reduction to 1 component)
- If maturing enough, link up to #stack.gl compute feature requests

****

### Usage

#### Stage Setup Options

Stages must be fed to gl-compute in the order of computations, a render stage (optional) provided lastly.
The computation cycle will pass the results of one stage to the next according to given name (see bellow).
The last computation stage will pass it's results back to the first stage as needed (looped algorithms).
(Logically, first stage data will be empty in the first pass, no data available from last stage).

```
var data = {	dataA: inputA, dataAOut: emptyFloats,
		dataB: inputB, dataBOut: emptyFloats,
		dataC: inputC, dataCOut: emptyFloats,
		dataD: inputD, dataDOut: emptyFloats,
		dataROut: emptyUInts
}

Example callback function
var callback = function() { console.log( this.output.object[this.output.location] ) }

var options = {
	type			: Stage Type - 'COMPUTE' (for the actual computations) or
								   'RENDER' (optional for visualization purposes only)

	draw			: Draw Flag - to activate/deactivate this stage on demand
	
	shape			: Stage Shape - These are the dimensions of this stages' output

	shaderSources	: Shader Sources - to use in this stage
					  (create them and don't worry about uniform declaration
					   check uniforms option bellow)

	uniforms		: Stage Inputs - Data input to be fed to gl-compute
	
	{ uniformName :
		{ type: 'sampler2D', object: object, location: string, shape: array, flip: boolean }
		
		These will be made into texture uniforms and fragment shader source
		will be generated and added correspondingly
		  
		Each named property here becomes the uniform name to be made available in the shader
		Both the sampler2D uniform and a ivec2 containing the shape of the input is generated
								  
		GLSL naming conventions apply
		  
		The code generation includes a header and comments for your reference
		(ie. Stage Name and generation/compilation loop)
		Use your browser's shader editor to check the complete GLSL code being compiled

	output			: Stage Output - definitions of the target object where data will be saved
	
		{ write: boolean, object: object, location: string, onUpdated: function }
		
			Write Output Flag - This is where the most performance impact occurs,
			use sparingly when intermediate results are required

			Object Reference
			Attribute name where the data buffer lies
			callback to a function when new data has been writen
}

Inititalise Stages - Provide options as an object, stages will be named here	
compute.preInit( { nameOfStage1: stageOptions1,
				   nameOfStage2: stageOptions2,
				   renderStage: stageRender } )
```
