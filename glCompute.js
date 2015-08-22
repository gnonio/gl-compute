'use strict'

var getContext 		= require('get-canvas-context')
var glExt 			= require("webglew")
var createFBO 		= require("gl-fbo")
var createShader 	= require('gl-shader')
var createBuffer 	= require("gl-buffer")
var createVAO 		= require("gl-vao")
var createTexture 	= require("gl-texture2d")

// GPU Computing on top of WebGL
function glCompute( htmlTargetId ) {

	this.containerId = htmlTargetId

	this.canvasContextOpts = {		
		premultipliedAlpha: false,
		preserveDrawingBuffer: false
		//alpha: false
	};
	
	this.stages = []
	this.computeLoop = 0
}

module.exports = glCompute

glCompute.prototype = {
	init: function() {
	
		//this.setupGL()
		
		return true;
	},
	
	setupGL: function( width, height, factor ) { // Factor just scales the canvas size
		// Get Canvas Container
		var container = document.getElementById( this.containerId )
		this.container = container
		
		if ( container === null ) throw "No such HTML element"
		
		this.width = width
		this.height = height
		this.factor = factor
		
		// Create Canvas Set WebGL Context
		//var gl = canvas.getContext("webgl2", this.canvasContextOpts );
		var gl = getContext('webgl2', { width: this.width, height: this.height } )
		if ( gl === null ) { 
			gl = getContext('webgl', { width: this.width, height: this.height } )
			console.log( "Fall back to WebGL 1.0. Failed creating WebGL 2 Context" )
			if ( gl === null ) throw "Unable to set WebGL";
		};
		this.gl = gl;		
		// Set Viewport - set by context above
		// gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		container.appendChild(gl.canvas)
		
		// Check WebGL Extensions
		var glExtensions = glExt(gl)
		this.glExtensions = glExtensions
		try {
			if ( !glExtensions.OES_texture_float ) throw "Your webgl does not support OES_texture_float extension."
		} catch ( error ) { console.log( error, glExtensions )}
		try {
			if ( !glExtensions.OES_texture_float_linear ) throw "Your webgl does not support OES_texture_float_linear extension."
		} catch ( error ) { console.log( error, glExtensions )}
		
		gl.canvas.style.width = this.width * this.factor
		gl.canvas.style.height = this.height * this.factor
		gl.canvas.style["image-rendering"] = "pixelated"
		gl.canvas.style["image-rendering"] = "-moz-crisp-edges"
	},
	
	preInit: function( stages ) {
		//var gl = this.gl
		
		// Let's do some variable checking here then
		var lastStageName = ''; var lastStageShape = []; var totalStages = 0; var preInitOK = true
		for( var stage in stages ) {
			if ( stages.hasOwnProperty( stage ) ) {
				var options = stages[ stage ]

				// Check Shape (dimensions) conformity
				if ( options.shape.length > 2 ) {
					preInitOK = false
					console.log(stage + ': Only 4 of components per fragment supported (Framebuffer and Renderbuffer in gl.RGBA)')
				} else {
					options.shape = [ options.shape[0], options.shape[1], 4 ]
				}
				
				// Check Stage Type
				if ( options.type == 'COMPUTE' || options.type == 'RENDER' ) {
					// We need the last stage name in order to set uniforms in first stage
					if ( options.type == 'COMPUTE' ) { lastStageName = stage; lastStageShape = options.shape; totalStages++ }
				} else {
					preInitOK = false
					console.log( stage + ': Stage type not properly set: ' + options.type + ' is not a valid stage type ' )
				}
				
				// Check Buffer output conformity
				var buffer = options.output.object[ options.output.location ]
				var length = options.shape[0] * options.shape[1] * options.shape[2]
				if ( options.type == 'COMPUTE' ) {
					if ( Object.prototype.toString.call( buffer ) != '[object Float32Array]' || buffer.length != length ) { // Expected
						preInitOK = false
						console.log( stage + ': Buffer type mismatch, it must match the fbo type (Float32Array) and size (' + length + '): ' +
							Object.prototype.toString.call( buffer ) + ' / ' + buffer.length )
					}
				} else { //this.type == 'RENDER'
					if ( Object.prototype.toString.call( buffer ) != '[object Uint8Array]' || buffer.length != length ) { // Expected
						preInitOK = false
						console.log( stage + ': Buffer type mismatch, it must match the render stage type (Uint8Array) and size (' + length + '): ' +
							Object.prototype.toString.call( buffer ) + ' / ' + buffer.length )
					}
				}
			}
		}
		if ( preInitOK ) {
			for( var name in stages ) {
				if ( stages.hasOwnProperty( name ) ) {
					var stage = new glComputeStage( this, name, { lastStageName: lastStageName, lastStageShape: lastStageShape, total: totalStages }, stages[ name ] )
				}
			}
		} else {
			console.log( 'Stage preInit failed' )
		}
	},
	
	// Process data
	processStages: function() {
		var gl = this.gl
		
		for ( var i = 0; i < this.stages.length; i++ ) {
		
			var computeStage = this.stages[i]			
			if( computeStage.draw ) {				
				computeStage.fbo.bind()				
				gl.viewport( 0, 0, computeStage.shape[0], computeStage.shape[1] )
				
				computeStage.shader.bind()
				computeStage.vertexBuffer.bind()
				computeStage.shader.attributes.position.pointer()

				computeStage.bindUniforms()
				
				gl.drawArrays(gl.TRIANGLES, 0, 6)
				
				if ( computeStage.output.write ) this.glReadStage( computeStage )
			}
		}
		this.computeLoop++
	},
	
	// Render Output to Screen	
	// Lets keep the Render stage separated to allow more flexibility defining presentation
	// ie. render all the results of different stages in a custom disposition
	// defaults to a quad and whatever is set by the fragment shader
	renderOutput: function() {
		var gl = this.gl
	
		var renderStage = this.renderStage
		if ( renderStage ) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null)		
			gl.viewport( 0, 0, renderStage.shape[0], renderStage.shape[1] )
			
			renderStage.shader.bind()
			renderStage.vertexBuffer.bind()
			renderStage.shader.attributes.position.pointer()

			renderStage.bindUniforms()
			
			gl.drawArrays(gl.TRIANGLES, 0, 6)			

			if ( renderStage.output.write ) this.glReadStage( renderStage )
		}
	},
	
	glReadStage: function ( stage ) {
		var gl = this.gl		
		// Stage Framebuffer DOES support FLOAT values BUT ONLY in RGBA

		// Postprocess Output - we may still need this here
	
		var format = ( stage.type == 'COMPUTE' ) ? gl.FLOAT : gl.UNSIGNED_BYTE // Render Buffer DOES NOT support FLOAT values directly
		gl.readPixels( 0, 0, stage.shape[0], stage.shape[1], gl.RGBA, format, stage.output.object[stage.output.location] )
		
		// Callback if set
		if ( stage.output.onUpdated ) stage.output.onUpdated.apply( stage )
		
	},
	
	getStageByName: function ( name ) {
		var stage = null
		for ( var i = 0; i < this.stages.length; i++ ) {
			var sstage = this.stages[i]
			if ( sstage.name == name ) stage = sstage
		}
		if ( this.renderStage.name == name ) stage = this.renderStage
		return stage
	},
	
	disposeStagesFBOs: function () {
		// Cleanup Framebuffers
		for ( var i = 0; i < this.stages.length; i++ ) {
			var stage = this.stages[i]
			stage.fbo.dispose()
		}
	}
}

function glComputeStage( glCompute, name, stages, options ) {
	this.glCompute = glCompute
	this.gl = glCompute.gl; var gl = this.gl
	this.name = name
	
	this.lastStageName = stages.lastStageName
	this.lastStageShape = stages.lastStageShape
	this.totalStages = stages.total
	
	this.type = options.type
	this.options = options // Save user options
	
	this.stageNumber = glCompute.stages.length // This is a running count when glComputeStage is called
	
	this.boundFBOs = 0		// These are critical values
	this.boundTextures = 0	// its referencing must be carefully managed
	
	// Set FBO for compute stages
	if ( this.type == 'COMPUTE' ) this.fbo = createFBO( gl, options.shape, {float: true, color: 1, depth: false} )
	
	// Set Draw flag
	this.draw = ( this.type == 'COMPUTE') ? options.draw : true // Always true for render if existing

	// Set Stage Shape
	this.shape = [ options.shape[0], options.shape[1], options.shape[2] ]
	
	// Set Output
	this.output = options.output
	
	// Set Vertex buffer | currently the same for both COMPUTE and RENDER stages
	this.vertexBuffer = createBuffer( gl, [ -1, 1, 1, 1, -1, -1,
													1, 1, 1, -1, -1, -1	], gl.STATICDRAW )

	// Set Stage Uniforms
	this.uniformsConfig = this.options.uniforms
	this.uniforms = {}
	this.setupUniforms()
	
	// TODO: allow to configure some post processing
	// Reduce / Column-Row transposition / etc (lets keep these as shaders)
	
	// we should also manage a flag providing an early check if data is "dirty" or not (ie. has been changed),
	// in both directions CPU > GPU < CPU
		
	// Create Shader
	this.shader = createShader( gl, this.vertexShader, this.fragmentShader )

	if ( this.type == 'COMPUTE') glCompute.stages.push( this )
	if ( this.type == 'RENDER') glCompute.renderStage = this
}
glComputeStage.prototype = {
	updateShader: function( shader ) {
		var gl = this.gl
		// Set Stage Uniforms
		this.options.shaderSources.vertex = shader.vertex
		this.options.shaderSources.fragment = shader.fragment
		
		// Vertex Shader stays the same for now
		this.vertexShader = this.options.shaderSources.vertex
		
		// Fragment Shader consolidate uniforms code generated
		this.fragmentSrc = '// STAGE - ' + this.name + ' | LOOP - ' + this.glCompute.computeLoop + ' \n// Generated User Defined Uniforms\n\n'
		var uniforms = this.uniforms
		for( var key in uniforms ) {
			if ( uniforms.hasOwnProperty(key) ) {
				var uniform = uniforms[key]
				this.fragmentSrc = this.fragmentSrc + uniform.fragmentSrc
			}
		}	
		this.fragmentShader = this.fragmentSrc + '// END Generated GLSL\n\n\n' + this.options.shaderSources.fragment
			
		// Create Shader
		this.shader = createShader( gl, this.vertexShader, this.fragmentShader )
	},
	setupUniforms: function() {
		var gl = this.gl
		
		// CONFIG - stage.uniformsConfig contain the configuration
		this.uniformsConfig.computeLoop = { type: 'int', data: this.glCompute } // this value is increased whenever a full stage cycle is over (excludes render)
		this.uniformsConfig.shape = { type: 'ivec3', data: this.shape }
		
		if ( this.type == 'COMPUTE' ) { // - lets add a uniform for the previous compute stage
			var previousStage = ( this.stageNumber > 0 ) ? this.glCompute.stages[this.stageNumber - 1] : { name: this.lastStageName, shape: this.lastStageShape }
			this.uniformsConfig[previousStage.name] = { type: 'fbo', data: previousStage.shape }
		} else { // this.type == 'RENDER' - lets add a uniform for each compute stage
			for( var i = 0; i < this.glCompute.stages.length; i++ ) {
				var computeStage = this.glCompute.stages[i]
				this.uniformsConfig[computeStage.name] = { type: 'fbo', data: computeStage.shape }
			}
		}
		
		// CREATION - glComputeUniform() will manage the actual uniforms saved in stage.uniforms | later to be fed to the shader
		var uniformsConfig = this.uniformsConfig
		for( var key in uniformsConfig ) {
			if ( uniformsConfig.hasOwnProperty(key) ) {
				var uniform = uniformsConfig[key]
				this.uniforms[key] = new glComputeUniform( gl, this, key, uniform )
			}
		}
		
		// Vertex Shader stays the same for now
		this.vertexShader = this.options.shaderSources.vertex
		
		// Fragment Shader consolidate uniforms code generated
		this.fragmentSrc = '// STAGE - ' + this.name + ' | LOOP - ' + this.glCompute.computeLoop + ' \n// Generated User Defined Uniforms\n\n'
		var uniforms = this.uniforms
		for( var key in uniforms ) {
			if ( uniforms.hasOwnProperty(key) ) {
				var uniform = uniforms[key]
				this.fragmentSrc = this.fragmentSrc + uniform.fragmentSrc
			}
		}	
		this.fragmentShader = this.fragmentSrc + '// END Generated GLSL\n\n\n' + this.options.shaderSources.fragment
	},
	bindUniforms: function() {
		var uniforms = this.uniforms
		// RESET counts
		// FBOs target textureUnit is always 0 for 'COMPUTE' Stages | for ' RENDER' Stage it is a count from 0 up to #Stages
		// sample2Ds target textureUnit starts always in 1 for 'COMPUTE' Stages | for ' RENDER' Stage it starts always from #Stages up to #MAX
		
		// CRITICAL PIECE OF CODE | TOO SENSITIVE TO CHANGES | SHOULD CONSOLIDATE ALL DEPENDENT CODE search for also: "var stageIndex = textureUnit"
		this.boundFBOs = 0
		this.boundTextures = ( this.type == 'COMPUTE') ? 1 : this.glCompute.stages.length

		for( var key in uniforms ) {
			if ( uniforms.hasOwnProperty(key) ) {
				uniforms[key].bind()
			}
		}
	}
}

function glComputeUniform( gl, stage, name, uniform ) {
	this.gl = gl
	this.stage = stage
	this.name = name
	this.type = uniform.type

	// Setting up glsl source to add to shaders
	this.fragmentSrc = ''	
	switch( this.type ) {
		case 'fbo':	// FBOs are created earlier at Stage Creation
			// Alternative naming: var name = stage.type == 'COMPUTE' ? 'previousStage' : this.name
			this.fragmentSrc = '// Previous Stage(s) Results\n\n' +
							   'uniform sampler2D ' + this.name + '; // FBO\n' +
							   'uniform ivec2 ' + this.name + 'Shape; // Shape\n\n'
			break;
		case 'sampler2D':
			this.createTexture( uniform.object, uniform.location, uniform.shape, uniform.flip )
			this.fragmentSrc = 'uniform sampler2D ' + this.name + '; // Input Data\n' +
							   'uniform ivec2 ' + this.name + 'Shape; // Dimensions\n\n'
			break;
		case 'ivec2':
		case 'ivec3':
		case 'int':
		case 'float':
			this.createData( uniform.data )
			this.fragmentSrc = 'uniform ' + this.type + ' ' + this.name + '; // Data\n\n'
			break;
		default:
			console.log('glComputeUniform.constructor(): Uniform type not yet implemented')
	}
	return this
}
glComputeUniform.prototype = {
	bind: function() {
		// CHECK here if data is dirty or not
		
		// COMPUTED DATA (FBOs) target textureUnit is always 0 for 'COMPUTE' Stages / count from 0 up to #Stages for 'RENDER' Stage
		// INPUT DATA (sample2D) target textureUnit always starts in 1 for 'COMPUTE' Stages | from #Stages up to #MAX for ' RENDER' Stage
		switch( this.type ) {
			case 'fbo':
				this.bindFBO( this.stage.boundFBOs )
				this.stage.boundFBOs++
				break;
			case 'sampler2D':
				this.bindTexture( this.stage.boundTextures )
				this.stage.boundTextures++
				break;
			case 'ivec2':
			case 'ivec3':
			case 'int':
			case 'float':
				this.bindData()
				break;
			default:
				console.log('glComputeUniform.bind(): Uniform type not yet implemented')
		}
	},
	bindFBO: function( textureUnit ) {
		var gl = this.gl
		var stage = this.stage
		
		var stageToBind		
		if ( stage.type == 'COMPUTE' ) {
			stageToBind = ( stage.stageNumber > 0 ) ? stage.glCompute.stages[ stage.stageNumber - 1 ] : stage.glCompute.stages[ stage.glCompute.stages.length - 1 ]
		}		
		if ( stage.type == 'RENDER' ) {
			var stageIndex = textureUnit // Particular case, given current structure textureUnit here is the same as the stage index be to bound
			stageToBind = stage.glCompute.stages[ stageIndex ]
		}
		
		// ISSUES with setting Uniform locations >> gl-shader (stack.gl) || Reverting to raw GL
		var location = gl.getUniformLocation( stage.shader.program, stageToBind.name );
		gl.uniform1i(location, textureUnit);			
		stage.shader.uniforms[ stageToBind.name ] = stageToBind.fbo.color[0].bind( textureUnit )
		
		var location2 = gl.getUniformLocation( stage.shader.program, stageToBind.name+'Shape' )
		gl.uniform2iv(location2, stageToBind.fbo._shape)
		stage.shader.uniforms[ stageToBind.name+'Shape' ] = stageToBind.fbo._shape
		
	},
	createTexture: function( object, location, shape, flip ) {
		var gl = this.gl
		this.data = object[location]
		this.location = location
		this.texture = gl.createTexture();
		this.shape = shape
		
		//gl.activeTexture(textureUnit);
		gl.bindTexture( gl.TEXTURE_2D, this.texture )
		
		// Flip the image's Y axis to match the WebGL texture coordinate space.
		if ( flip ) {
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
		} else {
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
		}
		// Set up texture so we can render any size image and so we are
		// working with pixels.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
		
		this.format = shape[2] > 1 ? gl.RGBA : gl.LUMINANCE // Lets use a single component if possible
		gl.texImage2D( gl.TEXTURE_2D, 0, this.format, shape[0], shape[1], 0, this.format, gl.FLOAT, this.data )
	},
	bindTexture: function( textureUnit ) {
		var gl = this.gl
		var key = this.name
		var stage = this.stage
		var location = gl.getUniformLocation( stage.shader.program, key )
		gl.uniform1i( location, textureUnit )
		
		gl.activeTexture(gl.TEXTURE0 + textureUnit)
		gl.bindTexture(gl.TEXTURE_2D, this.texture)
							
		var location2 = gl.getUniformLocation( stage.shader.program, key+'Shape' )
		gl.uniform2iv( location2, this.shape )
		stage.shader.uniforms[key+'Shape'] = this.shape
	},
	createData: function( data ) {
		this.data = data
	},
	bindData: function() {
		var gl = this.gl
		var stage = this.stage
		var name = this.name
		var location = gl.getUniformLocation( stage.shader.program, name )
		switch( this.type ) {
			case 'ivec2':
				gl.uniform2iv( location, this.data )
				stage.shader.uniforms[name] = this.data
				break;
			case 'ivec3':
				gl.uniform3iv( location, this.data )
				stage.shader.uniforms[name] = this.data
				break;
			case 'int':
				//console.log(this.data.computeLoop, this.stage.glCompute.computeLoop)
				gl.uniform1i( location, this.data.computeLoop )
				stage.shader.uniforms[name] = this.data.computeLoop
				break;
			case 'float':
				gl.uniform1f( location, this.data )
				stage.shader.uniforms[name] = this.data
				break;
			default:
				console.log('WARNING: defaulting to uniform float binding')
				gl.uniform1f( location, this.data )
				stage.shader.uniforms[name] = this.data
		}
	},
	disposeTexture: function() {
		gl.deleteTexture( this.texture )
	}
}

/* 
Clean UP - http://stackoverflow.com/questions/23598471/how-do-i-clean-up-and-unload-a-webgl-canvas-context-from-gpu-after-use

var numTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
for (var unit = 0; unit < numTextureUnits; ++unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
}
gl.bindBuffer(gl.ARRAY_BUFFER, null);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
gl.bindRenderbuffer(gl.RENDERBUFFER, null);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// Delete all your resources
// Note!!!: You'd have to change this code to delete the resources YOU created.
gl.deleteTexture(someTexture);
gl.deleteTexture(someOtherTexture);
gl.deleteBuffer(someBuffer);
gl.deleteBuffer(someOtherBuffer);
gl.deleteRenderbuffer(someRenderbuffer);
gl.deleteFramebuffer(someFramebuffer);


var buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
var numAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
for (var attrib = 0; attrib < numAttributes; ++attrib) {
  gl.vertexAttribPointer(attrib, 1, gl.FLOAT, false, 0, 0);
}
*/