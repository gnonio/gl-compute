# gl-compute

## WebGL Compute Framework

An attempt at creating a compute framework on top of WebGL. Based on some [#stack.gl](http://www.stack.gl) modules. There are projects alike, but either they require indepth knowledge of OpenGL to base projects of, they are too inflexible or they are too tied with a specific usage ([webclgl](https://github.com/stormcolor/webclgl) / [webgl-matrix-demo](https://github.com/watmough/webgl-matrix-demo) / [three.js - gpgpu flocking](http://jabtunes.com/labs/3d/gpuflocking/webgl_gpgpu_flocking6.html)).

****

### Install

1. clone the project
2. manualy install required modules: `npm install <module> (check dependencies in package.json)`
3. run browserify (it will warn if you missed any module above): `browserify js\modules.js -o js\node_modules.js`

****

### Todo

- Fix stuff
- Robustify and do more checks on user provided data
- Fix this install procedure, fix npm packaging
- Fix the resources (shaders) loading phase (so ugly), maybe even adopt glslify (I don't like much to have glsl mixed with javascript - loosing syntax highlighting)
- Provide some canned shaders to do some data post processing (input data 1 component > output data 4 components > output reduction to 1 component), pehaps also some pre-processing
- If maturing enough, link up to #stack.gl compute feature requests

****

### Usage

#### Stage Setup Options

Stages must be fed to gl-compute in the order of computations, a render stage (if any) provided lastly.
The computation cycle will pass the results of one stage to the next according to it's name (see bellow)
The last computation stage will pass it's results back to the first stage accordingly
(Logically, first stage data will be empty in the first pass, no data available from last stage)

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
									   'RENDER' (can be ommited, optional for visualization purposes only)

		draw			: Draw Flag - to activate/deactivate this stage on demand
		
		stageShape		: Stage Shape - These are the dimensions of this stages' output
						  Length = stageShape[0] * stageShape[1] * 4 (4 = number of components/colors per element)

		shaderSources	: Shader Sources - to use in this stage
						  (these are barebones, create them and don't worry about uniform declaration - check uniforms option bellow)

		uniforms		: Stage Inputs - Data input to be fed to gl-compute
		
			{ uniformName : { type: 'sampler2D', object: object, location: string, shape: array, flip: boolean }
			
						  These will be made into texture uniforms and fragment shader source will be generated and added correspondingly
						  
						  Each named property here becomes the uniform name to be made available in the shader
						  Both the sampler2D uniform and a ivec2 containing the shape (dimensions) of the input is generated
						  						  
						  GLSL naming conventions apply
						  
						  The code generation includes a header and comments for your reference (ie. Stage Name and generation/compilation loop)
						  Use your browser's shader editor to check the complete GLSL code being compiled

		output			: Stage Output - definitions of the target object where data will be saved
		
			{ write: boolean, object: object, location: string, onUpdated: function }
			
						  Write Output Flag - This is where the most performance impact occurs, use sparingly when intermediate results are required
		
						  Object Reference / Porperty name where the data buffer lies / callback to a function when new data has been writen
	}
	
	Inititalise Stages - Provide options as an object, stages will be named here	
	compute.stagePreInit( { nameOfStage1: stageOptions1, nameOfStage2: stageOptions2, nameOfStage3: stageOptions3, renderStage: stageRender } )
```

****
Disclaimer: Hobbyist approach. Not used to this package and modules managers from the point of the developer. I used npm to install modules. I am also keeping a custom file (modules.js) which once parsed by browserify spits a file exposing all dependencies the project requires into a single file (node_modules.js).
