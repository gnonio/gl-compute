// GPU Computing on top of WebGL
var glCompute = function( htmlTargetId ) {

	this.containerId = htmlTargetId

	this.canvasContextOpts = {		
		premultipliedAlpha: false,
		preserveDrawingBuffer: false
		//alpha: false
	};
	
	this.stages = []
	this.computeLoop = 0	
}

glCompute.prototype = {
	init: function() {
	
		//this.setupGL()
		
		return true;
	},
	
	setupGL: function( width, height, factor ) {
		// Get Canvas Container
		var container = document.getElementById( this.containerId )
		this.container = container
		
		if ( container === null ) throw "No such HTML element"
		
		this.width = width
		this.height = height
		this.factor = factor
		
		// Create Canvas Set WebGL Context
		//var gl = canvas.getContext("webgl2", this.canvasContextOpts );
		var gl = stackGL.getContext('webgl2', { width: this.width, height: this.height } )
		if ( gl === null ) { 
			gl = stackGL.getContext('webgl', { width: this.width, height: this.height } )
			console.log( "Fall back to WebGL 1.0. Failed creating WebGL 2 Context" )
			if ( gl === null ) throw "Unable to set WebGL";
		};
		this.gl = gl;		
		// Set Viewport - set by context above
		// gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		container.appendChild(gl.canvas)
		
		// Check WebGL Extensions
		var glExtensions = stackGL.glExt(gl)
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
	
	stagePreInit: function( stages ) {
		var gl = this.gl
		
		// Let's do some variable checking here then
		// (provide a warning when stage output shape differs from the receiving stage shape? other checks?)
		var lastStageName = ''; var totalStages = 0; var preflightOK = true
		for( var stage in stages ) {
			if ( stages.hasOwnProperty(stage) ) {
				if ( stages[ stage ].type == 'COMPUTE' || stages[ stage ].type == 'RENDER' ) {
					// We need the last stage name in order to set uniforms in first stage
					if ( stages[ stage ].type == 'COMPUTE' ) { lastStageName = stage; totalStages++ }
				} else {
					preflightOK = false
					console.log( 'Stage type not properly set: ' + stages[ stage ].type + ' is not a valid stage type ' + stage )
				}
			}
		}
		if ( preflightOK ) {
			for( var stage in stages ) {
				if ( stages.hasOwnProperty(stage) ) {
					var stage = new glComputeStage( this, stage, { lastStageName: lastStageName, total: totalStages }, stages[ stage ] )
				}
			}
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
		//console.log( 'LOOP ' + this.computeLoop )
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
		// IF we are LOOPING we must check if last stage type was 'COMPUTE' since the FIRST Stage will bug out reading the 'RENDER' buffer
		// Whenever we draw to the 'RENDER' buffer to read it WE MUST somehow keep the results of the previous 'COMPUTE' available for the FIRST Stage

		// Postprocess Output - we may still need this here
		
		// Render Buffer DOES NOT support FLOAT values		
		if ( stage.type == 'COMPUTE' ) {
			gl.readPixels( 0, 0, stage.shape[0], stage.shape[1], gl.RGBA, gl.FLOAT, stage.output.object[stage.output.location] )
		} else { //stage.type == 'RENDER'
			gl.readPixels( 0, 0, stage.shape[0], stage.shape[1], gl.RGBA, gl.UNSIGNED_BYTE, stage.output.object[stage.output.location] )
		}
		
		// Callback if set
		if ( stage.output.onUpdated ) stage.output.onUpdated.apply( stage )
		
	},
	
	disposeStagesFBOs: function () {
		// Cleanup Framebuffers
		for ( var i = 0; i < this.stages.length; i++ ) {
			var stage = this.stages[i]
			stage.fbo.dispose()
		}
	}
}

glComputeStage = function( glCompute, name, stages, options ) {	//stage, name, type, args
	this.glCompute = glCompute
	this.gl = glCompute.gl; var gl = this.gl
	this.name = name
	
	this.lastStageName = stages.lastStageName
	this.totalStages = stages.total
	
	this.type = options.type
	this.options = options
	
	this.stageNumber = glCompute.stages.length // This is a running count when glComputeStage is called
	this.boundFBOs = 0
	this.boundTextures = 0
	
	// Set Stage Shape
	if ( options.stageShape.length > 2 ) {
		//this.shape = [options.stageShape[0], options.stageShape[1], options.stageShape[2]]
		console.log('Only 4 components per fragment currently supported')
		this.shape = [ options.stageShape[0], options.stageShape[1], 4 ]
	} else {
		this.shape = [ options.stageShape[0], options.stageShape[1], 4 ]
	}

	// Set Draw flag
	this.draw = ( this.type == 'COMPUTE') ? options.draw : true // Always true for render if existing
		
	// Create Buffers and prepare callbacks
	this.output = options.output
	//this.readOutput = options.readOutput
	this.setStageBuffers()
	
	// For now vertex buffer is the same for both COMPUTE and RENDER stages
	this.vertexBuffer = stackGL.createBuffer( gl, [ -1, 1, 1, 1, -1, -1,
													1, 1, 1, -1, -1, -1	], gl.STATICDRAW )

	// SETUP Stage Uniforms
	
	// TODO: allow to pass inputs by reference. Outputs likewise but that will require integrated post processing (lets create a shader for this conversion)
	// A way to test this is by passing the object along with the keyname containing the data we are interested in
	// there should be alot of code savings and increased efficiency
	
	// we should also manage a flag providing an early check if data is "dirty" or not (ie. has been changed), in both directions CPU > GPU < CPU
	
	// CONFIG - stage.uniforms contain the configuration
	this.uniforms = options.uniforms
	
	this.uniforms.computeLoop = { type: 'int', data: this.glCompute } // this value is increased whenever a full stage cycle is over (excludes render)
	this.uniforms.stageShape = { type: 'ivec3', data: this.shape }
	
	if ( this.type == 'COMPUTE' ) { // - lets add a uniform for the previous compute stage
		var previousStage = ( this.stageNumber > 0 ) ? this.glCompute.stages[this.stageNumber - 1] : { name: this.lastStageName }
		this.uniforms[previousStage.name] = { type: 'fbo', data: previousStage.shape }
	} else { // this.type == 'RENDER' - lets add a uniform for each compute stage
		for( var i = 0; i < this.glCompute.stages.length; i++ ) {
			var computeStage = this.glCompute.stages[i]
			this.uniforms[computeStage.name] = { type: 'fbo', data: computeStage.shape }
		}
	}
	
	// CREATION - stage.shader.uniforms contains the actual uniforms
	var uniforms = this.uniforms
	for( var key in uniforms ) {
		if ( uniforms.hasOwnProperty(key) ) {
			var uniform = uniforms[key]
			this.uniforms[key] = new glComputeUniform( gl, this, key, uniform )
		}
	}	
	
	// Vertex Shader stays the same for now
	this.vertexShader = options.shaderSources.vertex
	// Fragment Shader consolidate uniforms code generated
	this.fragmentSrc = '// STAGE - ' + this.name + ' | LOOP - ' + this.glCompute.computeLoop + ' \n// Generated User Defined Uniforms\n\n'	
	for( var key in uniforms ) {
		if ( uniforms.hasOwnProperty(key) ) {
			var uniform = uniforms[key]
			this.fragmentSrc = this.fragmentSrc + uniform.fragmentSrc
		}
	}	
	this.fragmentShader = this.fragmentSrc + '// END Generated GLSL\n\n\n' + options.shaderSources.fragment
	
	// Create Shader
	this.shader = stackGL.createShader( gl, this.vertexShader, this.fragmentShader )

	if ( this.type == 'COMPUTE') glCompute.stages.push( this )
	if ( this.type == 'RENDER') glCompute.renderStage = this
}
glComputeStage.prototype = {
	setStageBuffers: function() {
		var gl = this.gl
		var options = this.options
		
		var buffer = options.output.object[options.output.location]
		if ( this.type == 'COMPUTE' ) {
			this.fbo = stackGL.createFBO( gl, options.stageShape, {float: true, color: 1, depth: false} )
			var length = this.shape[0] * this.shape[1] * this.shape[2]
			if ( Object.prototype.toString.call(buffer) == '[object Float32Array]' && buffer.length == length) { // Expected
				console.log('Buffer appears to be ok to use: ' + this.name )
				/*this.outputBuffer = options.outputBuffer ? options.outputBuffer : new Float32Array( this.shape[0] * this.shape[1] * this.shape[2] )
				this.outputCallback = options.outputCallback*/
			} else {
				console.log('Buffer type mismatch, if providing one it must match the fbo type (Float32Array) and size (' + length + '): ' +
					this.name + ' is ' +  Object.prototype.toString.call(buffer) + ' / ' + buffer.length)
				/*this.outputBuffer = new Float32Array( this.shape[0] * this.shape[1] * this.shape[2] )
				this.outputCallback = function() { console.log( this.outputBuffer ) }*/
			}
		} else { //this.type == 'RENDER'
			var length = this.shape[0] * this.shape[1] * this.shape[2]
			if ( Object.prototype.toString.call(buffer) == '[object Uint8Array]' && buffer.length == length) { // Expected
				console.log('Buffer appears to be ok to use: ' + this.name )
				/*this.outputBuffer = options.outputBuffer ? options.outputBuffer : new Uint8Array( this.shape[0] * this.shape[1] * this.shape[2] )
				this.outputCallback = options.outputCallback*/
			} else {
				console.log('Buffer type mismatch, if providing one it must match the render stage type (Uint8Array) and size (' + length + '): ' +
					this.name + ' is ' +  Object.prototype.toString.call(buffer) + ' / ' + buffer.length)
				/*this.outputBuffer = new Uint8Array( this.shape[0] * this.shape[1] * this.shape[2] )
				this.outputCallback = function() { console.log( this.outputBuffer ) }*/
			}
		}
	},
	bindUniforms: function() {
		var stage = this
		var uniforms = stage.uniforms
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

glComputeUniform = function( gl, stage, name, uniform ) {
	this.gl = gl
	this.stage = stage
	this.name = name
	this.type = uniform.type
	
	// WE SHOULD BE PASSING DATA AS OBJECTS (BY REFERENCE) ELSE WE ARE COPYING >>>> WE GET FREE UPDATES (ARE THEY REALLY FREE?)

	// Setting up glsl source to add to shaders
	this.fragmentSrc = ''	
	switch( this.type ) {
		case 'fbo':
			// FBOs are created earlier at Stage Creation
			this.fragmentSrc = '// Previous Stages Results\n\n' +
							   'uniform sampler2D ' + this.name + '; // FBO\n'+
							   'uniform ivec2 ' + this.name + 'Shape; // Shape\n\n'
			break;
		case 'sampler2D':
			this.createTexture( uniform.object, uniform.location, uniform.shape, uniform.flip )
			this.fragmentSrc = 'uniform sampler2D ' + this.name + '; // Input Data\n'+
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
				//console.log( this.stage.name + ' glComputeUniform.bind() fbo ' + this.name, 'textureUnit', this.stage.count, ' | UNBUGGING ' + this.stage.boundFBOs )
				this.stage.boundFBOs++
				break;
			case 'sampler2D':
				this.bindTexture( this.stage.boundTextures )
				//console.log( this.stage.name + ' glComputeUniform.bind() sampler2D ' + this.name, 'textureUnit', this.stage.count, ' | UNBUGGING ' + this.stage.boundTextures )
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
		
		this.format = shape[2] > 1 ? gl.RGBA : gl.LUMINANCE
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