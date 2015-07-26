import json

from twisted.web.resource import Resource
from jinja2 import Environment, PackageLoader

from flightsim.fdm import fdm_properties

class Index(Resource):
    isLeaf = False
    
    def __init__(self, fdmexec):
        Resource.__init__(self)
        
        self.fdmexec = fdmexec
    
    def getChild(self, name, request):
        if name == '':
            return self
        return Resource.getChild(self, name, request)
    
    def render_GET(self, request):
        env  = Environment(loader=PackageLoader("flightsim", "templates"))
        
        template = env.get_template("index.html")
        
        return str(template.render())

class FDMData(Resource):
    isLeaf = True
    
    def __init__(self, fdmexec):
        self.fdmexec = fdmexec
    
    def render_GET(self, request):
        request.responseHeaders.addRawHeader("content-type", "application/json")
        
        fdm_data = [(fdm_property, self.fdmexec.get_property_value(fdm_property))
                    for fdm_property in fdm_properties]
        
        fdm_data = dict(fdm_data)
        
        return json.dumps({"fdm_data": fdm_data})
    
class Controls(Resource):
    ifLeaf = True
    
    def __init__(self, fdmexec):
        self.fdmexec = fdmexec
        
    def render_POST(self, request):
        request.responseHeaders.addRawHeader("content-type", "application/json")
        
        data = request.content.read()
        
        try:
            controls_data = json.loads(data)
        except:
            return json.dumps({"response": "error"})
        
        self.fdmexec.set_property_value("fcs/elevator-cmd-norm", controls_data["fcs/elevator-cmd-norm"])
        self.fdmexec.set_property_value("fcs/aileron-cmd-norm", controls_data["fcs/aileron-cmd-norm"])
        self.fdmexec.set_property_value("fcs/rudder-cmd-norm", controls_data["fcs/rudder-cmd-norm"])
        self.fdmexec.set_property_value("fcs/throttle-cmd-norm", controls_data["fcs/throttle-cmd-norm"])
        
        return json.dumps({"response": "ok"})