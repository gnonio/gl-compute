// GPU Computing on top of WebGL
var glCompute = function( htmlTargetId ) {

	this.containerId = htmlTargetId;

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
		var container = document.getElementById( this.containerId );
		this.container = container;
		
		if ( container === null ) throw "No such HTML element";
		
		this.width = width
		this.height = height
		this.factor = factor
		
		// Create Canvas Set WebGL Context
		//var gl = canvas.getContext("webgl2", this.canvasContextOpts );
		var gl = stackGL.getContext('webgl2', { width: this.width, height: this.height } )
		if ( gl === null ) { 
			gl = stackGL.getContext('webgl', { width: this.width, height: this.height } )
			console.log( "Fall back to WebGL 1.0. Failed creating WebGL 2 Context" );
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
			if ( !glExtensions.OES_texture_float ) throw "Your webgl does not support OES_texture_float extension.";
		} catch ( error ) { console.log( error, glExtensions )};
		try {
			if ( !glExtensions.OES_texture_float_linear ) throw "Your webgl does not support OES_texture_float_linear extension.";
		} catch ( error ) { console.log( error, glExtensions )};
		
		gl.canvas.style.width = this.width * this.factor
		gl.canvas.style.height = this.height * this.factor
		gl.canvas.style["image-rendering"] = "pixelated"
		gl.canvas.style["image-rendering"] = "-moz-crisp-edges"
	},
	
	stagePreInit: function( stages ) {
		var gl = this.gl
		
		// this is bad practice and ugly but serves the purpose (there is no order guarantee)
		var lastStageName = ''; var totalStages = 0
		for( var stage in stages ) {
			if ( stages.hasOwnProperty(stage) ) {
				if ( stages[ stage ].type == 'COMPUTE' ) { lastStageName = stage; totalStages++ }
			}
		}
		for( var stage in stages ) {
			if ( stages.hasOwnProperty(stage) ) {
				var stage = new glComputeStage( this, stage, { lastStageName: lastStageName, total: totalStages }, stages[ stage ] )
			}
		}
		
	},
	
	// Process data
	processStages: function() {
		var gl = this.gl
		
		var output = []
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
				
				//if ( computeStage.readOutput ) output.push( this.glReadStage( computeStage ) )
				if ( computeStage.readOutput ) { computeStage.outputBuffer.data = this.glReadStage( computeStage ); computeStage.outputBuffer.callback() }
			}
		}
		//console.log( 'LOOP ' + this.computeLoop )
		this.computeLoop++
		return output
	},
	
	// Render Output to Screen	
	// Lets keep the Render stage separated to allow more flexibility defining presentation
	// ie. render all the results of different stages in a custom disposition
	// defaults to a quad and whatever is set by the fragment shader
	renderOutput: function() {
		var gl = this.gl

		var output = []		
		var renderStage = this.renderStage
		if ( renderStage ) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null)		
			gl.viewport( 0, 0, renderStage.shape[0], renderStage.shape[1] )
			
			renderStage.shader.bind()
			renderStage.vertexBuffer.bind()
			renderStage.shader.attributes.position.pointer()

			renderStage.bindUniforms()
			
			gl.drawArrays(gl.TRIANGLES, 0, 6)			

			//if ( renderStage.readOutput ) output = this.glReadStage( renderStage )
			if ( renderStage.readOutput ) { renderStage.outputBuffer.data = this.glReadStage( renderStage ); renderStage.outputBuffer.callback() }
			return output
		}
		return output
	},
	
	glReadStage: function ( stage ) {
		var gl = this.gl
		
		var readBuffer
		if ( stage.type == 'COMPUTE' ) {
			// Stage framebuffer DOES support FLOAT values BUT ONLY in RGBA
			// IF we are LOOPING we must check if last stage type was 'COMPUTE' since the FIRST Stage will bug out reading the 'RENDER' buffer
			// Whenever we draw to the 'RENDER' buffer to read it WE MUST somehow keep the results of the previous 'COMPUTE' available for the FIRST Stage
			readBuffer = new Float32Array( stage.shape[0] * stage.shape[1] * stage.shape[2] )
			gl.readPixels(0, 0, stage.shape[0], stage.shape[1], gl.RGBA, gl.FLOAT, readBuffer)
		}
		if ( stage.type == 'RENDER' ) {
			// Render framebuffer DOES NOT support FLOAT values
			readBuffer = new Uint8Array( stage.shape[0] * stage.shape[1] * stage.shape[2] )
			gl.readPixels(0, 0, stage.shape[0], stage.shape[1], gl.RGBA, gl.UNSIGNED_BYTE, readBuffer)
		}
		// Postprocess Output - we should not need this
		return readBuffer
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
	this.outputBuffer = options.outputBuffer
	this.options = options
	
	if ( this.type == 'COMPUTE' ) this.fbo = stackGL.createFBO( gl, options.stageShape, {float: true, color: 1, depth: false} )

	if ( options.stageShape.length > 2 ) {
		//this.shape = [options.stageShape[0], options.stageShape[1], options.stageShape[2]]
		console.log('Stage shape not supported. Stage output must have size 4 per element')
		this.shape = [ options.stageShape[0], options.stageShape[1], 4 ]
	} else {
		this.shape = [ options.stageShape[0], options.stageShape[1], 4 ]
	}
	
	// For now vertex buffer is the same for both COMPUTE and RENDER stages
	this.vertexBuffer = stackGL.createBuffer( gl, [ -1, 1, 1, 1, -1, -1,
													1, 1, 1, -1, -1, -1	], gl.STATICDRAW )

	this.fragmentSrc = '// STAGE - ' + this.name + ' | LOOP - ' + this.glCompute.computeLoop + ' \n// Generated User Defined Uniforms\n\n'
	
	// Setup stage global uniforms
	this.count = glCompute.stages.length
	this.boundFBOs = 0
	this.boundTextures = 0 // WE NEED THE FINAL NUMBER OF COMPUTING STAGES AT THIS POINT
	this.uniforms = options.uniforms
	
	// This is the First Compute Loop, we are creating the First Compute Stage | Last Compute Stage UNavailable
	// We must later call updateShader()
	
	// WE SHOULD BE PASSING DATA AS OBJECTS (BY REFERENCE) ELSE WE ARE COPYING >>>> WE GET FREE UPDATES (ARE THEY REALLY FREE?)
	// A way to test this is by passing the object along with the keyname containing the data we are interested in
	// there should be alot of code savings and increased efficiency
	// we should also manage a flag providing an early check if data is "dirty" or not
	this.uniforms.computeLoop = { type: 'int', data: this.glCompute }
	this.uniforms.stageShape = { type: 'ivec3', shape: this.shape }
	
	// These are the follow up Compute Stages and Final Render Stage | Last Compute Stage is now available
	if ( this.type == 'COMPUTE') {
		var previousStage = ( this.count > 0 ) ? this.glCompute.stages[this.count - 1] : { name: this.lastStageName }
		this.uniforms[previousStage.name] = { type: 'fbo', shape: previousStage.shape }
	} else if ( this.type == 'RENDER') {
		for( var i = 0; i < this.glCompute.stages.length; i++ ) {
			var computeStage = this.glCompute.stages[i]
			this.uniforms[computeStage.name] = { type: 'fbo', shape: computeStage.shape }
		}
	}
	
	// Setup user defined uniforms
	var uniforms = this.uniforms
	for( var key in uniforms ) {
		if ( uniforms.hasOwnProperty(key) ) {
			var uniform = uniforms[key]
			var args = {}; var c = 0
			for( var n in uniform ) {
				if ( uniforms.hasOwnProperty(key) ) {
					if ( c > 0 ) args[n] = uniform[n]
					c++
				}
			}
			this.uniforms[key] = new glComputeUniform( gl, this, key, uniform.type, args )
		}
	}
	
	this.vertexShader = options.shaderSources.vertex
	this.fragmentShader = this.fragmentSrc + '// END Generated GLSL\n\n\n' + options.shaderSources.fragment
	
	this.shader = stackGL.createShader( gl, this.vertexShader, this.fragmentShader )

	this.draw = ( this.type == 'COMPUTE') ? options.draw : true
	this.readOutput = options.readOutput

	if ( this.type == 'COMPUTE') glCompute.stages.push( this )
	if ( this.type == 'RENDER') glCompute.renderStage = this
}
glComputeStage.prototype = {
	bindUniforms: function() {
		var stage = this
		var uniforms = stage.uniforms
		// RESET counts
		// FBOs target textureUnit is always 0 for 'COMPUTE' Stages | for ' RENDER' Stage it is a count from 0 up to #Stages
		// CRITICAL PIECE OF CODE | TOO SENSITIVE TO CHANGES | SHOULD CONSOLIDATE ALL DEPENDENT CODE search for also: "var stageIndex = textureUnit"
		this.boundFBOs = 0
		// sample2Ds target textureUnit starts always in 1 for 'COMPUTE' Stages | for ' RENDER' Stage it starts always from #Stages up to #MAX
		this.boundTextures = ( this.type == 'COMPUTE') ? 1 : this.glCompute.stages.length // WE NEED THE FINAL NUMBER OF COMPUTING STAGES AT THIS POINT

		for( var key in uniforms ) {
			if ( uniforms.hasOwnProperty(key) ) {
				uniforms[key].bind()
			}
		}
	}
}

glComputeUniform = function( gl, stage, name, type, args ) {
	this.gl = gl
	this.stage = stage
	this.name = name
	this.type = type
	
	this.fragmentSrc = ''
	
	// WE SHOULD BE PASSING DATA AS OBJECTS (BY REFERENCE) ELSE WE ARE COPYING >>>> WE GET FREE UPDATES (ARE THEY REALLY FREE?)
	
	if ( type == 'fbo' ) {
		this.fragmentSrc = 'uniform sampler2D ' + this.name + '; // Previous Stages Results\n'+
							'uniform ivec2 ' + this.name + 'Shape; // Shape\n\n'
		stage.fragmentSrc = stage.fragmentSrc + this.fragmentSrc
	} else if ( type == 'sampler2D' ) {
		this.createTexture( args.data, args.shape, args.flip )
		this.fragmentSrc = 'uniform sampler2D ' + this.name + '; // Input Data\n'+
							'uniform ivec2 ' + this.name + 'Shape; // Shape\n\n'
		stage.fragmentSrc = stage.fragmentSrc + this.fragmentSrc
	} else if ( type == 'ivec2' ) {
		this.createData( args.shape )
		this.fragmentSrc = 'uniform ivec2 ' + this.name + '; // Shape\n\n'
		stage.fragmentSrc = stage.fragmentSrc + this.fragmentSrc
	} else if ( type == 'ivec3' ) {
		this.createData( args.shape )
		this.fragmentSrc = 'uniform ivec3 ' + this.name + '; // Shape\n\n'
		stage.fragmentSrc = stage.fragmentSrc + this.fragmentSrc
	} else if ( type == 'int' ) {
		this.createData( args.data )
		this.fragmentSrc = 'uniform int ' + this.name + '; // Current Compute Pass | Some code may be conditional on this\n\n'
		stage.fragmentSrc = stage.fragmentSrc + this.fragmentSrc
	} else {
		console.log('glComputeUniform.constructor(): Uniform format not yet implemented')
	}
	return this
}
glComputeUniform.prototype = {
	bind: function() {
		// CHECK here if data is dirty or not
		if ( this.type == 'fbo' ) {
			// FBOs target textureUnit is always 0 for 'COMPUTE' Stages | for ' RENDER' Stage it is a count from 0 up to #Stages
			this.bindFBO( this.stage.boundFBOs )
			//console.log( this.stage.name + ' glComputeUniform.bind() fbo ' + this.name, 'textureUnit', this.stage.count, ' | UNBUGGING ' + this.stage.boundFBOs )
			this.stage.boundFBOs++				
		} else if ( this.type == 'sampler2D' ) {
			// sample2Ds target textureUnit starts always in 1 for 'COMPUTE' Stages | for ' RENDER' Stage it starts always from #Stages up to #MAX			
			this.bindTexture( this.stage.boundTextures )
			//console.log( this.stage.name + ' glComputeUniform.bind() sampler2D ' + this.name, 'textureUnit', this.stage.count, ' | UNBUGGING ' + this.stage.boundTextures )
			this.stage.boundTextures++
		} else if ( this.type == 'ivec2' ) {
			this.bindData()	
		} else if ( this.type == 'ivec3' ) {
			this.bindData()	
		} else if ( this.type == 'int' ) {
			this.bindData()
		} else {
			console.log('glComputeUniform.bind(): Uniform format not yet implemented')
		}
	},
	bindFBO: function( textureUnit ) {
		var gl = this.gl
		var stage = this.stage
		//var textureUnit = 0
		if ( stage.type == 'COMPUTE' ) {
			// ASSUMES only the output results of previous stage will be shared in the current
			var prevStage = ( stage.count > 0 ) ? stage.glCompute.stages[ stage.count - 1 ] : stage.glCompute.stages[ stage.glCompute.stages.length - 1 ]
			
			// ISSUES with setting Uniform locations >> gl-shader (stack.gl) || Reverting to raw GL
			var location = gl.getUniformLocation( stage.shader.program, prevStage.name );
			gl.uniform1i(location, textureUnit);			
			stage.shader.uniforms[ prevStage.name ] = prevStage.fbo.color[0].bind( textureUnit )
			
			var location2 = gl.getUniformLocation( stage.shader.program, prevStage.name+'Shape' )
			gl.uniform2iv(location2, prevStage.fbo._shape)
			stage.shader.uniforms[ prevStage.name+'Shape' ] = prevStage.fbo._shape			
			//console.log( 'COMPUTE (stage.count > 0) ' + prevStage.name + ' fbo TO ' + textureUnit )
		}
		if ( stage.type == 'RENDER' ) {
			var stageIndex = textureUnit // Particular case
			var computeStage = stage.glCompute.stages[stageIndex]
			
			var location = gl.getUniformLocation(stage.shader.program, computeStage.name);			
			gl.uniform1i(location, textureUnit);			
			stage.shader.uniforms[computeStage.name] = computeStage.fbo.color[0].bind(textureUnit)
			
			var location2 = gl.getUniformLocation( stage.shader.program, computeStage.name+'Shape' )
			gl.uniform2iv(location2, computeStage.fbo._shape)
			stage.shader.uniforms[computeStage.name+'Shape'] = computeStage.fbo._shape			
			//console.log( 'RENDER ' + computeStage.name + ' fbo TO ' + textureUnit )
		}
	},
	createTexture: function( data, shape, flip ) {
		var gl = this.gl
		this.data = data
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
		gl.texImage2D( gl.TEXTURE_2D, 0, this.format, shape[0], shape[1], 0, this.format, gl.FLOAT, data )
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