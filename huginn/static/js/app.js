var map;
var follow_aircraft;
var aircraft_marker;
var myhud;
var entity;
var waypoints = new Object();

var aircraft_info = L.control();

var attitude_indicator;
var altitude_indicator;
var airspeed_indicator;
var heading_indicator;
var variometer_indicator;

var fdm_data_request_timer = null;
var socket = null;

aircraft_info.onAdd = function(map){
	this._div = L.DomUtil.create("div", "aircraft-info");
	this.update();
	return this._div;
}

aircraft_info.update = function(data){
	var contents;
	
	if(data){
		var airspeed = data["airspeed"];
		var altitude = data["altitude"];
		var heading = data["heading"];
		var latitude = data["latitude"];
		var longitude = data["longitude"];
		
		contents = "<b>Latitude:</b> " + latitude.toFixed(5) + " degrees<br>" + 
		           "<b>Longitude:</b> " + longitude.toFixed(5) +" degrees<br>" +
		           "<b>Altitude:</b> " + altitude.toFixed(1) + " meters<br>" +
		           "<b>Heading:</b> " + heading.toFixed(1) + " degrees<br>" +
		           "<b>Airspeed:</b> " + airspeed.toFixed(1) + " meters/sec";
	}else{
		contents = "no data";
	}
	
	this._div.innerHTML = contents;
}

function init_map(){
	map = L.map('map').setView([51.0, 0.0], 13);
	
	L.tileLayer("http://{s}.tile.osm.org/{z}/{x}/{y}.png", {
		attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);
	
	var aircraftIcon = L.icon({
	    iconUrl: 'static/images/32px-Airplane_silhouette.png',

	    iconSize:     [32, 32],
	    iconAnchor:   [16, 16]
	});
	
	aircraft_marker = L.marker([51.0, 0.0], {icon: aircraftIcon}).addTo(map);
	
	//aircraft_marker = L.marker([51.0, 0.0]).addTo(map);
	
	aircraft_info.addTo(map);
} 

function update_hud(altitude, airspeed, heading, roll, pitch){
	myhud.roll = roll;
	myhud.pitch = pitch;
	myhud.airspeed = airspeed;
	myhud.altitude = altitude;
	myhud.heading = heading;
	
	myhud.draw();
}

function update_map(latitude, longitude){	  
	if(follow_aircraft){
		map.setView([latitude, longitude], 13);
	}
	
	aircraft_marker.setLatLng([latitude, longitude]);
}

function update_3dmap(latitude, longitude, altitude, airspeed, heading, roll, pitch){
	var position = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);
	var heading_in_radians = Cesium.Math.toRadians(heading);
	var roll_in_radians = Cesium.Math.toRadians(roll);
	var pitch_in_radians = Cesium.Math.toRadians(pitch);
    var orientation = Cesium.Transforms.headingPitchRollQuaternion(position, heading_in_radians, pitch_in_radians, roll_in_radians);
    
    entity.position = position;
    entity.orientation = orientation;
}

function update_indicators(roll, pitch, altitude, airspeed, heading, climb_rate){
	attitude_indicator.setRoll(roll);
    attitude_indicator.setPitch(pitch);
    
    heading_indicator.setHeading(heading);
         
    airspeed_indicator.setAirSpeed(airspeed);
    
    altimeter_indicator.setAltitude(altitude);
    vario = (climb_rate * 60.0) / 1000.0;
    variometer_indicator.setVario(vario);
}

function start_data_update(){	
	socket = new WebSocket("ws://localhost:8091");

	socket.onopen = function(){
		fdm_data_request_timer = setInterval(function(){
			socket.send(JSON.stringify({"command": "flight_data"}));
		}, 40);

		fdm_data_request_timer = setInterval(function(){
			socket.send(JSON.stringify({"command": "waypoints"}));
		}, 1000);
	}
	
	socket.onmessage = function(msg){
		response = JSON.parse(msg.data);

		if (response["command"] == "flight_data"){		
			var roll = response["data"]["roll"];
			var pitch = response["data"]["pitch"];
			var airspeed = response["data"]["airspeed"];
			var altitude = response["data"]["altitude"];
			var heading = response["data"]["heading"];
			var latitude = response["data"]["latitude"];
			var longitude = response["data"]["longitude"];
			var climb_rate = response["data"]["climb_rate"];
		
			update_hud(altitude, airspeed, heading, roll, pitch);
		
			update_3dmap(latitude, longitude, altitude, airspeed, heading+90.0, -roll, -pitch);

			var airspeed_in_knots = airspeed * 1.94384;
			var altitude_in_feet = altitude * 3.28084;
			var climb_rate_in_feet = climb_rate * 3.28084;
			update_indicators(roll, pitch, altitude_in_feet, airspeed_in_knots, heading, climb_rate_in_feet);
		} else if (response["command"] == "waypoints"){
		    var existing_waypoints = [];

		    for(var i = 0; i < response["data"].length; i++){
		        existing_waypoints.push(response["data"][i]["name"]);

                var w = waypoints[response["data"][i]["name"]];

                if(!w){
                    var marker =  L.marker([response["data"][i]["latitude"], response["data"][i]["longitude"]]);
                    marker.addTo(map);
                    waypoints[response["data"][i]["name"]] = marker;
                }else{
                    w.setLatLng(L.latLng(response["data"][i]["latitude"], response["data"][i]["longitude"]));
                }
		    }

		    for(var key in waypoints){
		        if(waypoints.hasOwnProperty(key)){
		            if(existing_waypoints.indexOf(key) == -1){
		                var w = waypoints[key];
		                map.removeLayer(w);
		                delete waypoints[key];
		            }
		        }
		    }
		}
	}
	
	socket.onclose = function(){
		if (fdm_data_request_timer != null){
			clearInterval(fdm_data_request_timer);
		}

		setTimeout(function(){
			start_data_update();
		}, 1000);
	}
	
	socket.onerror = function(){
		socket.close();
	}
}

function start_fdm_data_update(){
	setInterval(function(){
		$.getJSON("fdm", function(data){
			$("#time").text(data["time"]);
			$("#dt").text(data["dt"]);
			$("#latitude").text(data["latitude"]);
			$("#longitude").text(data["longitude"]);
			$("#altitude").text(data["altitude"]);
			$("#airspeed").text(data["airspeed"]);
			$("#heading").text(data["heading"]);
			$("#x-acceleration").text(data["x_acceleration"]);
			$("#y-acceleration").text(data["y_acceleration"]);
			$("#z-acceleration").text(data["z_acceleration"]);
			$("#roll-rate").text(data["roll_rate"]);
			$("#pitch-rate").text(data["pitch_rate"]);
			$("#yaw-rate").text(data["yaw_rate"]);
			$("#temperature").text(data["temperature"]);
			$("#static-pressure").text(data["static_pressure"]);
			$("#total-pressure").text(data["total_pressure"]);
			$("#roll").text(data["roll"]);
			$("#pitch").text(data["pitch"]);
			$("#thrust").text(data["thrust"]);
			$("#aileron").text(data["aileron"]);
			$("#elevator").text(data["elevator"]);
			$("#rudder").text(data["rudder"]);
			$("#throttle").text(data["throttle"]);
			$("#climb_rate").text(data["climb_rate"]);
			
			update_map(data["latitude"], data["longitude"]);
			aircraft_info.update(data);
		});
	}, 1000);
}

$(document).ready(function(){
	init_map();
	
	var primaryFlightDisplayCanvas = document.getElementById("primary_flight_diplay");
    
	myhud = new Avionics.PrimaryFlightDisplay(primaryFlightDisplayCanvas);
	
	myhud.roll = 0.0;
	myhud.pitch = 0.0;
	myhud.airspeed = 0.0;
	myhud.altitude = 0.0;
	myhud.heading = 0.0;
	
	myhud.draw();
	
	start_data_update();
	start_fdm_data_update();
	
	follow_aircraft = $("#follow_aircraft").is(":checked");
	
	$("#follow_aircraft").click(function(){
		follow_aircraft = this.checked;
	});
	
	var viewer = new Cesium.Viewer('cesiumContainer', {
	    imageryProvider : Cesium.createOpenStreetMapImageryProvider({
	        url : 'https://a.tile.openstreetmap.org/'
	    }),
	    geocoder: false,
	    baseLayerPicker : false
	});
	
	var position = Cesium.Cartesian3.fromDegrees(-123.0744619, 44.0503706, 5000.0);
	var heading = Cesium.Math.toRadians(135);
	var pitch = 0;
	var roll = 0;
	var orientation = Cesium.Transforms.headingPitchRollQuaternion(position, heading, pitch, roll);

	entity = viewer.entities.add({
	        name : "aircraft",
	        position : position,
	        orientation : orientation,
	        model : {
	            uri : "static/models/Rascal110-000-013.gltf",
	            minimumPixelSize : 128,
	            maximumScale : 20000
	        }
	});
	
	viewer.trackedEntity = entity;
	
	$("#resume_button").click(function(){
		$.post("simulator", data={"command": "resume"}, datatype="json");
	});
	
	$("#pause_button").click(function(){
        $.post("simulator", data={"command": "pause"}, datatype="json");
	});
	
	$("#reset_button").click(function(){
		$.post("simulator", data={"command": "reset"}, datatype="json");
	});
	
	attitude_indicator = $.flightIndicator('#attitude_indicator', 'attitude', {img_directory: "static/img/"});
	heading_indicator = $.flightIndicator('#heading_indicator', 'heading', {img_directory: "static/img/"});
	airspeed_indicator = $.flightIndicator('#airspeed_indicator', 'airspeed', {img_directory: "static/img/"});
	altimeter_indicator = $.flightIndicator('#altimeter_indicator', 'altimeter', {img_directory: "static/img/"});
	variometer_indicator = $.flightIndicator('#variometer_indicator', 'variometer', {img_directory: "static/img/"});
})