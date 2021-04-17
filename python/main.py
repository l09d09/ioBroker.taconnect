import requests
import json
import sys, getopt

try: 
    from BeautifulSoup import BeautifulSoup
except ImportError:
    from bs4 import BeautifulSoup

units=["",
            "°C",
            "W/m²", 
            "l/h", 
            "sek",
            "min",
            "l/Imp",
            "K",
            "%",
            "kW",
            "kWh",
            "MWh",
            "V",
            "mA",
            "Std",
            "Tage",
            "Imp",
            "kΩ",
            "l",
            "km/h",
            "Hz",
            "l/min",
            "bar",
            "",
            "km",
            "m",
            "mm",
            "m³",
            "l/d",
            "m/s",
            "m³/min",
            "m³/h",
            "m³/d",
            "mm/min",
            "mm/h",
            "mm/d",
            "Aus/EIN",
            "NEIN/JA",
            "°C",
            "€",
            "$"
        ];


def main(argv):
    try:
        cmi_username=argv[1]
        cmi_password=argv[2]
        ipadress=argv[3]
    except IndexError:
        print ("Usage: main.py <username> <password> <ipadress>")
        exit(2)

    baseadress="http://"+cmi_username+":"+cmi_password+"@"+ipadress
    try:
        r= requests.get (baseadress+"/INCLUDE/can_nodes.cgi")
    except:
        print (baseadress)
        exit(2)
    #print (r.status_code)
    #print (r.text.split(";"))

    nodeIdList=r.text.split(";")
    nodes=[]
    for nodeid in nodeIdList :
        if nodeid != "": 
            #print (baseadress+"/can_knoten.cgi?node="+nodeid)
            r=requests.get(baseadress+"/can_knoten.cgi?node="+nodeid)
            if r.status_code==200: 
                parsed_html=BeautifulSoup(r.content, "html.parser")
                jsonNode={
                    "image": parsed_html.find('img')['src'], 
                    "type": parsed_html.find('img')['title'], 
                    "name": parsed_html.find('div', attrs={'class':'nodebez'}).text.split("\r")[2], 
                    "link": "menupagex.cgi?nodex2="+hex(int(nodeid))[2:]+"005800",
                    "canid":nodeid
                }
                r=requests.get(baseadress+"/INCLUDE/api.cgi?jsonnode="+nodeid+"&jsonparam=I,O,D")
                jsonNode["content"]=r.json()
                nodes.append(jsonNode)
    print(json.dumps(nodes))
        #else: print ("no node id")

if __name__ == "__main__":
   main(sys.argv)
