from fastapi import APIRouter, Response
import xml.etree.ElementTree as ET
from app.database import videos_collection

router = APIRouter(
    prefix="/api/v1/export",
    tags=["Export"]
)

@router.get("/marcxml", response_class=Response)
async def export_to_marcxml():
    # 1. Get all the videos from db
    videos = await videos_collection.find().to_list(1000)

    # 2. Creating root element of the XML-doc
    collection = ET.Element("collection", xmlns="http://www.loc.gov/MARC21/slim")

    for video in videos:
        record = ET.SubElement(collection, "record")

        leader = ET.SubElement(record, "leader")
        leader.text = "00000nam a2200000 a 4500"

        # 245 field: Title
        datafield_245 = ET.SubElement(record, "datafield", tag="245", ind1="0", ind2="0")
        subfield_245a = ET.SubElement(datafield_245, "subfield", code="a")
        subfield_245a.text = video.get("title", "Senza titolo")

        # 100 and 700 fields: Authors
        authors = video.get("authors", [])
        if authors:
            # 100 field: main author
            datafield_100 = ET.SubElement(record, "datafield", tag="100", ind1="1", ind2=" ")
            subfield_100a = ET.SubElement(datafield_100, "subfield", code="a")
            subfield_100a.text = authors[0]

            # All other co-authors go in the repeating field 700
            for co_author in authors[1:]:
                datafield_700 = ET.SubElement(record, "datafield", tag="700", ind1="1", ind2=" ")
                subfield_700a = ET.SubElement(datafield_700, "subfield", code="a")
                subfield_700a.text = co_author

        # 650 field: tags
        for tag in video.get("tags", []):
            datafield_650 = ET.SubElement(record, "datafield", tag="650", ind1=" ", ind2="0")
            subfield_650a = ET.SubElement(datafield_650, "subfield", code="a")
            subfield_650a.text = tag

        # 856 field: Link to the video (Microsoft Streams)
        if video.get("azure_stream_url"):
            datafield_856 = ET.SubElement(record, "datafield", tag="856", ind1="4", ind2="0")
            subfield_856u = ET.SubElement(datafield_856, "subfield", code="u")
            subfield_856u.text = video.get("azure_stream_url")

    # 4. Convert the assembled XML tree into a finished string
    xml_str = ET.tostring(collection, encoding="utf-8", method="xml")

    # 5. We return a response with the correct media type so that the browser recognizes it as XML
    return Response(content=xml_str, media_type="application/xml")