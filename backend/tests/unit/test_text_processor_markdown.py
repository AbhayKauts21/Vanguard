from app.services.text_processor import TextProcessor


def test_clean_markdown_strips_basic_markdown_syntax():
    processor = TextProcessor()

    clean_text = processor.clean_markdown(
        "# CheckingMate\n\n"
        "- **Workers** complete forms\n"
        "1. Review the assignment\n"
        "2. Submit findings\n"
        "Read the [development guide](https://example.com/dev).\n"
    )

    assert "#" not in clean_text
    assert "**" not in clean_text
    assert "[" not in clean_text
    assert "development guide" in clean_text
    assert "Workers complete forms" in clean_text


def test_process_document_text_adds_generic_source_metadata():
    processor = TextProcessor(chunk_size=120, chunk_overlap=20)

    chunks = processor.process_document_text(
        page_id=123456,
        page_title="CheckingMate Architecture",
        text_content=(
            "# CheckingMate Architecture\n\n"
            "CheckingMate is a checklist and survey management platform.\n\n"
            "It uses a layered architecture with controllers, use cases, and repositories."
        ),
        source_url="file:///tmp/checkingmate.md",
        source_type="local_markdown",
        source_name="CheckingMate Product Docs",
        collection_id=601,
    )

    assert chunks
    assert chunks[0].metadata["page_id"] == 123456
    assert chunks[0].metadata["page_title"] == "CheckingMate Architecture"
    assert chunks[0].metadata["source_type"] == "local_markdown"
    assert chunks[0].metadata["source_name"] == "CheckingMate Product Docs"
    assert chunks[0].metadata["book_id"] == 601
    assert chunks[0].metadata["bookstack_url"] == "file:///tmp/checkingmate.md"
