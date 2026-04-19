'use client';

export default function ImagePreview({ images, onRemove }) {
    if (!images || images.length === 0) return null;

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
            {images.map((img, index) => (
                <div
                    key={index}
                    className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={img.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                    />
                    {/* Overlay xóa */}
                    <button
                        type="button"
                        onClick={() => onRemove(index)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                    </button>
                    {/* Badge số thứ tự */}
                    <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {index + 1}
                    </span>
                </div>
            ))}
        </div>
    );
}
